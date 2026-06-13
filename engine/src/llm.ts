// Model-agnostic call site. The engine only knows this interface; swapping or
// tuning providers happens here + in engine/config/models.json.

import Anthropic from "@anthropic-ai/sdk";
import type { PassUsage } from "./types";
import type { PassModelConfig } from "./config";

// Adaptive thinking + the effort parameter are supported on Opus 4.5+ / Sonnet
// 4.6 / Fable 5, but NOT on Haiku or older models (they 400). Build the
// thinking/output_config knobs per model so a cheap-model choice in
// models.json degrades gracefully instead of erroring.
function tuning(pass: PassModelConfig, extra: Record<string, unknown> = {}) {
  const supportsAdaptive = !/haiku|claude-3/.test(pass.model);
  return supportsAdaptive
    ? { thinking: { type: "adaptive" as const }, output_config: { effort: pass.effort, ...extra } }
    : { output_config: { ...extra } };
}

export interface StructuredCall {
  system: string;
  user: string;
  schema: object;
  pass: PassModelConfig;
}

export interface StructuredResult<T> {
  output: T;
  usage: PassUsage;
  model: string;
  durationMs: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TextStreamCall {
  system: string;
  messages: ChatTurn[];
  pass: PassModelConfig;
  /** Called with each text delta as it streams. */
  onDelta: (text: string) => void;
}

export interface TextStreamResult {
  text: string;
  usage: PassUsage;
  model: string;
  durationMs: number;
}

export interface LlmProvider {
  completeStructured<T>(call: StructuredCall): Promise<StructuredResult<T>>;
  streamText(call: TextStreamCall): Promise<TextStreamResult>;
  /** streamText with server-side web search + web fetch tools enabled. */
  researchText(call: TextStreamCall): Promise<TextStreamResult>;
}

class AnthropicProvider implements LlmProvider {
  private client: Anthropic;

  constructor() {
    // Reads ANTHROPIC_API_KEY from the environment.
    this.client = new Anthropic();
  }

  async completeStructured<T>(call: StructuredCall): Promise<StructuredResult<T>> {
    const started = Date.now();

    // Stream to avoid HTTP timeouts on long dossier outputs.
    const stream = this.client.messages.stream({
      model: call.pass.model,
      max_tokens: call.pass.maxTokens,
      ...tuning(call.pass, { format: { type: "json_schema", schema: call.schema as Record<string, unknown> } }),
      // System prompt is stable across calls within a pass type — cache it.
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: call.user }],
    } as Anthropic.MessageStreamParams);

    let message;
    try {
      message = await stream.finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.BadRequestError && e.message.includes("grammar is too large")) {
        throw new Error(
          "The output schema exceeds the API's structured-output grammar limit. " +
            "A schema edit (likely in engine/config/schema/) re-introduced too much structural complexity — " +
            "see the $comment at the top of dossier.schema.json for the constraints and how to test cheaply."
        );
      }
      throw e;
    }

    if (message.stop_reason === "max_tokens") {
      throw new Error(
        `LLM output truncated at max_tokens=${call.pass.maxTokens} (model ${call.pass.model}). Raise maxTokens in engine/config/models.json.`
      );
    }
    if (message.stop_reason === "refusal") {
      throw new Error("The model refused this request. Check the input data for problematic content.");
    }

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in model response.");
    }

    let output: T;
    try {
      output = JSON.parse(textBlock.text) as T;
    } catch (e) {
      throw new Error(`Model returned unparseable JSON despite schema enforcement: ${(e as Error).message}`);
    }

    return {
      output,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
      model: message.model,
      durationMs: Date.now() - started,
    };
  }

  async researchText(call: TextStreamCall): Promise<TextStreamResult> {
    const started = Date.now();
    let usage: PassUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let model = call.pass.model;
    let text = "";

    // Server-side tools run a server-side loop; it may pause (stop_reason
    // "pause_turn") and must be resumed by re-sending the conversation.
    const messages: Anthropic.MessageParam[] = call.messages.map((m) => ({ role: m.role, content: m.content }));
    for (let round = 0; round < 8; round++) {
      const stream = this.client.messages.stream({
        model: call.pass.model,
        max_tokens: call.pass.maxTokens,
        ...tuning(call.pass),
        system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
        messages,
        tools: [
          { type: "web_search_20260209", name: "web_search", max_uses: 12 },
          { type: "web_fetch_20260209", name: "web_fetch", max_uses: 15 },
        ],
      } as Anthropic.MessageStreamParams);

      stream.on("text", (delta) => {
        text += delta;
        call.onDelta(delta);
      });

      const message = await stream.finalMessage();
      usage = {
        inputTokens: usage.inputTokens + message.usage.input_tokens,
        outputTokens: usage.outputTokens + message.usage.output_tokens,
        cacheReadTokens: usage.cacheReadTokens + (message.usage.cache_read_input_tokens ?? 0),
        cacheWriteTokens: usage.cacheWriteTokens + (message.usage.cache_creation_input_tokens ?? 0),
      };
      model = message.model;

      if (message.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: message.content });
        continue;
      }
      break;
    }

    return { text, usage, model, durationMs: Date.now() - started };
  }

  async streamText(call: TextStreamCall): Promise<TextStreamResult> {
    const started = Date.now();

    const stream = this.client.messages.stream({
      model: call.pass.model,
      max_tokens: call.pass.maxTokens,
      ...tuning(call.pass),
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: call.messages.map((m) => ({ role: m.role, content: m.content })),
    } as Anthropic.MessageStreamParams);

    stream.on("text", (delta) => call.onDelta(delta));

    const message = await stream.finalMessage();
    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    return {
      text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
      },
      model: message.model,
      durationMs: Date.now() - started,
    };
  }
}

export function getProvider(provider: string): LlmProvider {
  switch (provider) {
    case "anthropic":
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown LLM provider '${provider}' in engine/config/models.json`);
  }
}
