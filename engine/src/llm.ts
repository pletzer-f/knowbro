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
    // Gather runs a web-search agentic loop on Opus + adaptive thinking. The
    // model is silent (thinking + searching) for a couple of minutes and only
    // writes the pack AT THE END, so the timeout must be a generous BACKSTOP
    // (let it complete, don't truncate) — the route's heartbeat keeps the
    // connection alive through the silent phase. Cutting it short yields an
    // empty pack. 300s sits under the /api/gather route's 600s maxDuration.
    const HARD_TIMEOUT_MS = 300_000;
    const MAX_ROUNDS = 2;
    let usage: PassUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let model = call.pass.model;
    let text = "";
    let stoppedEarly = false;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);
    try {
      const messages: Anthropic.MessageParam[] = call.messages.map((m) => ({ role: m.role, content: m.content }));
      for (let round = 0; round < MAX_ROUNDS; round++) {
        if (controller.signal.aborted) break;
        const stream = this.client.messages.stream(
          {
            model: call.pass.model,
            max_tokens: call.pass.maxTokens,
            ...tuning(call.pass),
            system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
            messages,
            // web_search only — web_fetch (reading whole pages) is the slow
            // part that prevents the loop from converging to synthesis.
            tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
          } as Anthropic.MessageStreamParams,
          { signal: controller.signal }
        );

        stream.on("text", (delta) => {
          text += delta;
          call.onDelta(delta);
        });

        let message;
        try {
          message = await stream.finalMessage();
        } catch (e) {
          // Abort (timeout) or transient stream error: keep what streamed.
          if (controller.signal.aborted) {
            stoppedEarly = true;
            break;
          }
          throw e;
        }
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
    } finally {
      clearTimeout(timer);
    }

    if (stoppedEarly) {
      const note =
        "\n\n[Gather hit its time limit — returning what was found. Re-gather, narrow the country/ticker, or paste a key page above if something important is missing.]";
      text += note;
      call.onDelta(note);
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
