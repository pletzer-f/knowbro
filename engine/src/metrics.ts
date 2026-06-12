// Promptable metrics: the user asks for specific financial metrics/ratios;
// the analyst computes them from the dossier + the current model. Engine
// standards apply (see engine/config/prompts/metrics.md).

import type { Dossier } from "./types";
import { loadEngineConfig } from "./config";
import { getProvider } from "./llm";

export interface MetricsContext {
  companyName: string;
  dossier: Dossier;
  modelParams: unknown; // ModelParams (lib/model.ts) — engine stays UI-agnostic
  modelOutputs: unknown; // computed scenario results, serialized by the caller
}

export async function computeMetrics(
  ctx: MetricsContext,
  request: string,
  onDelta: (text: string) => void
): Promise<string> {
  const config = loadEngineConfig();
  const provider = getProvider(config.models.provider);

  const system = [
    config.metricsSystemPrompt,
    `# Company\n\n${ctx.companyName}`,
    `# Dossier (JSON)\n\n${JSON.stringify(ctx.dossier, null, 2)}`,
    `# Current financial-model parameters (user-maintained)\n\n${JSON.stringify(ctx.modelParams, null, 2)}`,
    `# Computed model outputs (deterministic, from the parameters above)\n\n${JSON.stringify(ctx.modelOutputs, null, 2)}`,
  ].join("\n\n---\n\n");

  const result = await provider.streamText({
    system,
    messages: [{ role: "user", content: request }],
    pass: config.models.passes.chat,
    onDelta,
  });

  return result.text;
}
