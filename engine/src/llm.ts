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

export interface LlmProvider {
  completeStructured<T>(call: StructuredCall): Promise<StructuredResult<T>>;
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

    const message = await stream.finalMessage();

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
}

export function getProvider(provider: string): LlmProvider {
  switch (provider) {
    case "anthropic":
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown LLM provider '${provider}' in engine/config/models.json`);
  }
}
