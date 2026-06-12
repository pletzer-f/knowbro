// Model-agnostic call site. The engine only knows this interface; swapping or
// tuning providers happens here + in engine/config/models.json.

import Anthropic from "@anthropic-ai/sdk";
import type { PassUsage } from "./types";
import type { PassModelConfig } from "./config";

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
      thinking: { type: "adaptive" },
      output_config: {
        effort: call.pass.effort,
        format: { type: "json_schema", schema: call.schema as Record<string, unknown> },
      },
      // System prompt is stable across calls within a pass type — cache it.
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: call.user }],
    });

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

  async streamText(call: TextStreamCall): Promise<TextStreamResult> {
    const started = Date.now();

    const stream = this.client.messages.stream({
      model: call.pass.model,
      max_tokens: call.pass.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: call.pass.effort },
      system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
      messages: call.messages.map((m) => ({ role: m.role, content: m.content })),
    });

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
