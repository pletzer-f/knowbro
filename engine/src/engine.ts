// The engine: draft -> red-team critique -> revise. One analysis, computed once;
// lenses are presentation transforms applied later (see lens.ts / the UI).

import type { AnalysisInput, AnalysisResult, Critique, Dossier, TraceStep } from "./types";
import { loadEngineConfig, type EngineConfig } from "./config";
import { getProvider, type LlmProvider } from "./llm";
import { newTraceId, saveTrace } from "./trace";

function buildAnalysisUserPrompt(input: AnalysisInput): string {
  const parts = [
    `# Company to analyse\n\n${input.companyName}`,
    `# Provided data (the ONLY company-specific source material you may use)\n\n${input.rawData}`,
  ];
  if (input.userNotes?.trim()) {
    parts.push(
      `# User's private notes (lawfully-held knowledge provided by the user — treat as user_provided basis)\n\n${input.userNotes}`
    );
  }
  return parts.join("\n\n---\n\n");
}

function buildCritiqueUserPrompt(input: AnalysisInput, draft: Dossier): string {
  return [
    `# Original source data\n\n${input.rawData}`,
    input.userNotes?.trim() ? `# User's private notes\n\n${input.userNotes}` : "",
    `# Draft dossier to review (JSON)\n\n${JSON.stringify(draft, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function buildReviseUserPrompt(input: AnalysisInput, draft: Dossier, critique: Critique): string {
  return [
    `# Original source data\n\n${input.rawData}`,
    input.userNotes?.trim() ? `# User's private notes\n\n${input.userNotes}` : "",
    `# Your draft dossier (JSON)\n\n${JSON.stringify(draft, null, 2)}`,
    `# Reviewer findings (JSON)\n\n${JSON.stringify(critique, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export interface AnalyzeOptions {
  /** Skip the critique+revise passes (debugging / cheap runs only). */
  draftOnly?: boolean;
  onProgress?: (phase: "draft" | "critique" | "revise", state: "start" | "done") => void;
}

export async function analyze(input: AnalysisInput, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
  const config: EngineConfig = loadEngineConfig();
  const provider: LlmProvider = getProvider(config.models.provider);
  const steps: TraceStep[] = [];
  const traceId = newTraceId(input.companyName);

  // Pass 1 — draft analysis
  opts.onProgress?.("draft", "start");
  const draftUser = buildAnalysisUserPrompt(input);
  const draftRes = await provider.completeStructured<Dossier>({
    system: config.analysisSystemPrompt,
    user: draftUser,
    schema: config.dossierSchema,
    pass: config.models.passes.draft,
  });
  steps.push({
    pass: "draft",
    model: draftRes.model,
    startedAt: new Date(Date.now() - draftRes.durationMs).toISOString(),
    durationMs: draftRes.durationMs,
    systemPrompt: config.analysisSystemPrompt,
    userPrompt: draftUser,
    output: draftRes.output,
    usage: draftRes.usage,
  });
  opts.onProgress?.("draft", "done");

  let critique: Critique = { findings: [], overall_assessment: "Critique pass skipped (draftOnly)." };
  let final: Dossier = draftRes.output;

  if (!opts.draftOnly) {
    // Pass 2 — red-team critique
    opts.onProgress?.("critique", "start");
    const critiqueUser = buildCritiqueUserPrompt(input, draftRes.output);
    const critiqueRes = await provider.completeStructured<Critique>({
      system: config.critiqueSystemPrompt,
      user: critiqueUser,
      schema: config.critiqueSchema,
      pass: config.models.passes.critique,
    });
    critique = critiqueRes.output;
    steps.push({
      pass: "critique",
      model: critiqueRes.model,
      startedAt: new Date(Date.now() - critiqueRes.durationMs).toISOString(),
      durationMs: critiqueRes.durationMs,
      systemPrompt: config.critiqueSystemPrompt,
      userPrompt: critiqueUser,
      output: critique,
      usage: critiqueRes.usage,
    });
    opts.onProgress?.("critique", "done");

    // Pass 3 — revision (only if the reviewer found anything actionable)
    const actionable = critique.findings.filter((f) => f.severity !== "low");
    if (critique.findings.length > 0 && actionable.length > 0) {
      opts.onProgress?.("revise", "start");
      const reviseUser = buildReviseUserPrompt(input, draftRes.output, critique);
      const reviseRes = await provider.completeStructured<Dossier>({
        system: config.reviseSystemPrompt,
        user: reviseUser,
        schema: config.dossierSchema,
        pass: config.models.passes.revise,
      });
      final = reviseRes.output;
      steps.push({
        pass: "revise",
        model: reviseRes.model,
        startedAt: new Date(Date.now() - reviseRes.durationMs).toISOString(),
        durationMs: reviseRes.durationMs,
        systemPrompt: config.reviseSystemPrompt,
        userPrompt: reviseUser,
        output: final,
        usage: reviseRes.usage,
      });
      opts.onProgress?.("revise", "done");
    }
  }

  const result: AnalysisResult = {
    traceId,
    input,
    draft: draftRes.output,
    critique,
    final,
    steps,
    configFingerprint: config.fingerprint,
  };

  saveTrace(result);
  return result;
}
