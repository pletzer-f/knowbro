// Lens = presentation transform over the single engine output. No LLM call,
// no second pipeline: the same Dossier, reshaped (order, depth, emphasis,
// which summary field is foregrounded).

import type { Dossier, LensConfig, SectionKey } from "./types";

export interface LensedSection {
  key: SectionKey;
  title: string;
  emphasis: "high" | "normal" | "low";
  expandedByDefault: boolean;
}

export const SECTION_TITLES: Record<SectionKey, string> = {
  snapshot: "Snapshot & overall confidence",
  business_model: "Business model",
  ownership_control: "Ownership & control",
  financial_picture: "Financial picture",
  capital_structure_health: "Capital structure & health",
  investment_angle: "Investment angle",
  what_we_dont_know: "What we don't know",
};

export interface LensedDossier {
  lens: LensConfig;
  dossier: Dossier;
  sections: LensedSection[];
}

export function applyLens(dossier: Dossier, lens: LensConfig): LensedDossier {
  const sections: LensedSection[] = lens.section_order.map((key) => ({
    key,
    title: SECTION_TITLES[key],
    emphasis: lens.section_emphasis[key] ?? "normal",
    expandedByDefault: lens.sections_expanded.includes(key),
  }));
  return { lens, dossier, sections };
}

/** Pick the lens-appropriate summary for a section object. */
export function lensSummary(
  section: { summary: string; plain_language_summary: string },
  lens: LensConfig
): string {
  return lens.summary_field === "plain_language_summary"
    ? section.plain_language_summary || section.summary
    : section.summary;
}
