// Loads the engine's editable config: system prompt, inference chains, prompts,
// schemas, lenses, model settings. Everything the owner iterates on lives in
// engine/config/ — this module just assembles it.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { LensConfig } from "./types";

const CONFIG_DIR = path.join(process.cwd(), "engine", "config");

function read(rel: string): string {
  return fs.readFileSync(path.join(CONFIG_DIR, rel), "utf-8");
}

/** Strip HTML comments (version markers, editor notes) before prompt assembly. */
function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/** Remove $comment keys (documentation in the schema files) — the API rejects them. */
function stripSchemaComments<T>(node: T): T {
  if (Array.isArray(node)) return node.map(stripSchemaComments) as T;
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$comment") continue;
      out[k] = stripSchemaComments(v);
    }
    return out as T;
  }
  return node;
}

export interface PassModelConfig {
  model: string;
  maxTokens: number;
  effort: "low" | "medium" | "high" | "max";
}

export interface ModelsConfig {
  provider: string;
  passes: {
    draft: PassModelConfig;
    critique: PassModelConfig;
    revise: PassModelConfig;
    chat: PassModelConfig;
    gather: PassModelConfig;
    metrics: PassModelConfig;
    triage: PassModelConfig;
  };
}

export interface EngineConfig {
  analysisSystemPrompt: string; // persona + all chains + output instructions
  critiqueSystemPrompt: string;
  reviseSystemPrompt: string;
  chatSystemPrompt: string;
  metricsSystemPrompt: string;
  gatherSystemPrompt: string;
  triageSystemPrompt: string;
  dossierSchema: object;
  critiqueSchema: object;
  triageSchema: object;
  models: ModelsConfig;
  lenses: LensConfig[];
  /** sha256 over all config inputs — recorded in every trace so output quality
   *  can be attributed to a specific config version. */
  fingerprint: string;
}

export function loadEngineConfig(): EngineConfig {
  const systemPrompt = read("system-prompt.md");

  const chainsDir = path.join(CONFIG_DIR, "chains");
  const chainFiles = fs
    .readdirSync(chainsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();
  const chains = chainFiles.map((f) => read(path.join("chains", f)));

  const outputInstructions = read("prompts/output-instructions.md");
  const critiquePrompt = read("prompts/critique.md");
  const revisePrompt = read("prompts/revise.md");
  const chatPrompt = read("prompts/chat.md");
  const metricsPrompt = read("prompts/metrics.md");
  const gatherPrompt = read("prompts/gather.md");
  const triagePrompt = read("prompts/triage.md");

  const dossierSchema = stripSchemaComments(JSON.parse(read("schema/dossier.schema.json")));
  const critiqueSchema = stripSchemaComments(JSON.parse(read("schema/critique.schema.json")));
  const triageSchema = stripSchemaComments(JSON.parse(read("schema/triage.schema.json")));
  const models: ModelsConfig = JSON.parse(read("models.json"));

  const lensesDir = path.join(CONFIG_DIR, "lenses");
  const lenses: LensConfig[] = fs
    .readdirSync(lensesDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(read(path.join("lenses", f))));

  const analysisSystemPrompt = [
    stripComments(systemPrompt),
    "# Inference chains\n\nRun every chain below that the data supports. Show your working as specified per chain.",
    ...chains.map(stripComments),
    stripComments(outputInstructions),
  ].join("\n\n---\n\n");

  const fingerprintInput = [
    systemPrompt,
    ...chains,
    outputInstructions,
    critiquePrompt,
    revisePrompt,
    chatPrompt,
    metricsPrompt,
    gatherPrompt,
    triagePrompt,
    JSON.stringify(dossierSchema),
    JSON.stringify(critiqueSchema),
    JSON.stringify(triageSchema),
    JSON.stringify(models),
  ].join("\n");
  const fingerprint = crypto.createHash("sha256").update(fingerprintInput).digest("hex").slice(0, 12);

  return {
    analysisSystemPrompt,
    critiqueSystemPrompt: stripComments(critiquePrompt),
    reviseSystemPrompt: stripComments(revisePrompt),
    chatSystemPrompt: stripComments(chatPrompt),
    metricsSystemPrompt: stripComments(metricsPrompt),
    gatherSystemPrompt: stripComments(gatherPrompt),
    triageSystemPrompt: stripComments(triagePrompt),
    dossierSchema,
    critiqueSchema,
    triageSchema,
    models,
    lenses,
    fingerprint,
  };
}
