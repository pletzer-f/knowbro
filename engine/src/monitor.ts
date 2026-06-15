// Monitoring engine: the cheap triage (does anything material differ between
// two source packs?) and the deterministic dossier delta (what moved between
// two analyses). Triage runs on Haiku; the delta is pure code (free).

import type { ConfidenceLevel, Dossier, Estimate } from "./types";
import { loadEngineConfig } from "./config";
import { getProvider } from "./llm";

export interface TriageChange {
  field: string;
  summary: string;
  old: string;
  new: string;
  materiality: "high" | "medium" | "low" | "none";
}
export interface TriageResult {
  changes: TriageChange[];
  overall_materiality: "high" | "medium" | "low" | "none";
  recommendation: string;
}

/** Cheap comparison of two gathered packs — flags only material change. */
export async function triagePacks(previousPack: string, newPack: string): Promise<TriageResult> {
  const config = loadEngineConfig();
  const provider = getProvider(config.models.provider);
  const user = [
    "# Previous public-data pack\n\n" + (previousPack.trim() || "(none on record)"),
    "# Freshly gathered public-data pack\n\n" + newPack,
  ].join("\n\n---\n\n");
  const res = await provider.completeStructured<TriageResult>({
    system: config.triageSystemPrompt,
    user,
    schema: config.triageSchema,
    pass: config.models.passes.triage,
  });
  return res.output;
}

// ---------------------------------------------------------------------------
// Deterministic delta between two dossiers (free).
// ---------------------------------------------------------------------------

export interface ConfidenceShift {
  id: string;
  label: string;
  from: ConfidenceLevel;
  to: ConfidenceLevel;
  direction: "up" | "down";
}
export interface DossierDelta {
  verdict_changed: boolean;
  health_changed: { from: string; to: string } | null;
  confidence_shifts: ConfidenceShift[];
  deal_killers_added: string[];
  deal_killers_removed: string[];
  unknowns_from: number;
  unknowns_to: number;
  has_changes: boolean;
}

function allEstimates(d: Dossier): Estimate[] {
  return [
    ...d.business_model.estimates,
    ...d.ownership_control.estimates,
    ...d.financial_picture.estimates,
    ...d.capital_structure_health.estimates,
    ...d.investment_angle.estimates,
  ];
}

const CONF_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

export function computeDelta(prev: Dossier, next: Dossier): DossierDelta {
  const prevEst = new Map(allEstimates(prev).map((e) => [e.id, e]));
  const confidence_shifts: ConfidenceShift[] = [];
  for (const e of allEstimates(next)) {
    const before = prevEst.get(e.id);
    if (before && before.confidence.level !== e.confidence.level) {
      confidence_shifts.push({
        id: e.id,
        label: e.label,
        from: before.confidence.level,
        to: e.confidence.level,
        direction: CONF_RANK[e.confidence.level] > CONF_RANK[before.confidence.level] ? "up" : "down",
      });
    }
  }

  const prevKillers = new Set(prev.conclusions.deal_killers.map((k) => k.title.toLowerCase().trim()));
  const nextKillers = new Set(next.conclusions.deal_killers.map((k) => k.title.toLowerCase().trim()));
  const deal_killers_added = next.conclusions.deal_killers
    .filter((k) => !prevKillers.has(k.title.toLowerCase().trim()))
    .map((k) => k.title);
  const deal_killers_removed = prev.conclusions.deal_killers
    .filter((k) => !nextKillers.has(k.title.toLowerCase().trim()))
    .map((k) => k.title);

  const verdict_changed = prev.conclusions.verdict.trim() !== next.conclusions.verdict.trim();
  const health_changed =
    prev.conclusions.health_verdict !== next.conclusions.health_verdict
      ? { from: prev.conclusions.health_verdict, to: next.conclusions.health_verdict }
      : null;

  const has_changes =
    verdict_changed ||
    !!health_changed ||
    confidence_shifts.length > 0 ||
    deal_killers_added.length > 0 ||
    deal_killers_removed.length > 0;

  return {
    verdict_changed,
    health_changed,
    confidence_shifts,
    deal_killers_added,
    deal_killers_removed,
    unknowns_from: prev.what_we_dont_know.items.length,
    unknowns_to: next.what_we_dont_know.items.length,
    has_changes,
  };
}

/** One-line human summary of a triage + delta, for the changes feed. */
export function summarizeChange(triage: TriageResult, delta: DossierDelta | null): string {
  const top = triage.changes.find((c) => c.materiality === "high") || triage.changes[0];
  const lead = top ? top.summary : "Material change detected";
  if (!delta) return lead;
  const bits: string[] = [];
  if (delta.health_changed) bits.push(`health ${delta.health_changed.from} → ${delta.health_changed.to}`);
  const down = delta.confidence_shifts.filter((s) => s.direction === "down").length;
  const up = delta.confidence_shifts.filter((s) => s.direction === "up").length;
  if (down) bits.push(`${down} confidence drop${down === 1 ? "" : "s"}`);
  if (up) bits.push(`${up} confidence gain${up === 1 ? "" : "s"}`);
  if (delta.deal_killers_added.length) bits.push(`+${delta.deal_killers_added.length} deal-killer`);
  if (delta.verdict_changed) bits.push("verdict revised");
  return bits.length ? `${lead} — ${bits.join(", ")}` : lead;
}
