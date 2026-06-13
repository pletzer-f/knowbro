// Structural quality checks run against every engine output. These cannot judge
// analytical sharpness (that's the human review against humanReviewHints), but
// they catch regressions in the engine's discipline: missing confidence,
// missing inference paths, padded deal-killers, lazy unknowns, fact-dressing.

import type { AnalysisResult, Dossier, Estimate, SectionCore } from "../src/types";

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

function allEstimates(d: Dossier): { section: string; e: Estimate }[] {
  const out: { section: string; e: Estimate }[] = [];
  const sections: [string, SectionCore][] = [
    ["business_model", d.business_model],
    ["ownership_control", d.ownership_control],
    ["financial_picture", d.financial_picture],
    ["capital_structure_health", d.capital_structure_health],
    ["investment_angle", d.investment_angle],
  ];
  for (const [name, s] of sections) for (const e of s.estimates) out.push({ section: name, e });
  return out;
}

export function runChecks(result: AnalysisResult): CheckResult[] {
  const d = result.final;
  const checks: CheckResult[] = [];
  const add = (name: string, pass: boolean, detail = "") => checks.push({ name, pass, detail });

  // 1. All seven sections materially present
  const sectionsOk =
    !!d.snapshot?.one_liner &&
    !!d.business_model?.summary &&
    !!d.ownership_control?.summary &&
    !!d.financial_picture?.summary &&
    !!d.capital_structure_health?.summary &&
    !!d.investment_angle?.summary &&
    (d.what_we_dont_know?.items?.length ?? 0) > 0;
  add("seven-sections-present", sectionsOk);

  // 2. Overall confidence + every section confidence present with rationale
  const confs = [
    d.snapshot.overall_confidence,
    d.business_model.confidence,
    d.ownership_control.confidence,
    d.financial_picture.confidence,
    d.capital_structure_health.confidence,
    d.investment_angle.confidence,
  ];
  add(
    "confidence-everywhere-with-rationale",
    confs.every((c) => c && c.level && c.rationale.trim().length > 10),
    confs.filter((c) => !c || !c.rationale || c.rationale.trim().length <= 10).length + " thin/missing rationales"
  );

  // 3. Financial picture attempts core estimates (revenue + profitability)
  const finIds = d.financial_picture.estimates.map((e) => e.id.toLowerCase());
  const hasRevenue = finIds.some((id) => id.includes("revenue") || id.includes("turnover"));
  const hasMargin = finIds.some((id) => id.includes("margin") || id.includes("ebitda") || id.includes("profit"));
  add("revenue-and-margin-attempted", hasRevenue && hasMargin, `financial estimates: [${finIds.join(", ")}]`);

  // 4. Every estimate has an inference path and confidence
  const ests = allEstimates(d);
  const badEst = ests.filter(
    ({ e }) => e.inference_path.length === 0 || !e.confidence?.level || !e.confidence.rationale
  );
  add(
    "every-estimate-has-path-and-confidence",
    ests.length > 0 && badEst.length === 0,
    badEst.map((b) => `${b.section}/${b.e.id}`).join(", ") || `${ests.length} estimates OK`
  );

  // 5. No fact-dressing: nothing tagged filed_fact may carry sub-high confidence
  //    with estimate-like language; nothing tagged estimate may claim high confidence
  //    without a multi-method reconciliation.
  const dressed = ests.filter(
    ({ e }) => (e.basis === "estimate" || e.basis === "inference") && e.confidence.level === "high" && e.methods.length < 2
  );
  add(
    "no-high-confidence-single-method-estimates",
    dressed.length === 0,
    dressed.map((x) => `${x.section}/${x.e.id}`).join(", ")
  );

  // 6. Multi-method discipline: at least one estimate reconciles >= 2 methods
  const multiMethod = ests.filter(({ e }) => e.methods.length >= 2 && e.reconciliation.trim().length > 0);
  add("at-least-one-multi-method-reconciliation", multiMethod.length >= 1, `${multiMethod.length} found`);

  // 7. Deal-killers: exactly 2 or 3, each with rationale
  const dk = d.conclusions.deal_killers;
  add(
    "deal-killers-2-or-3-with-rationale",
    dk.length >= 2 && dk.length <= 3 && dk.every((k) => k.rationale.trim().length > 20),
    `${dk.length} deal-killers`
  );

  // 8. Decisive verdict + investment thesis + owner motivation read present and non-hedged-empty
  add(
    "decisive-verdict-thesis-and-owner-read",
    d.conclusions.verdict.trim().length > 80 &&
      d.conclusions.investment_thesis.trim().length > 120 &&
      d.conclusions.owner_motivation_read.trim().length > 80,
    `verdict ${d.conclusions.verdict.length}, thesis ${d.conclusions.investment_thesis.length}, owner read ${d.conclusions.owner_motivation_read.length} chars`
  );

  // 8b. Range discipline: revenue estimate states a most-likely value, not just a band
  const revEst = d.financial_picture.estimates.find((e) => e.id.toLowerCase().includes("revenue"));
  add(
    "revenue-estimate-has-most-likely-value",
    !!revEst && /most likely|midpoint|~/i.test(revEst.value),
    revEst ? `value: "${revEst.value}"` : "no revenue estimate"
  );

  // 9. Unknowns: 4-10 items, each with a concrete diligence question
  const unknowns = d.what_we_dont_know.items;
  // A diligence ask is valid whether phrased as a question ("What is the
  // customer concentration?") or an imperative ("Confirm the lease terms").
  // Require substance, not punctuation; report how many are question-form.
  const substantive = unknowns.every((u) => u.diligence_question.trim().length > 15);
  const questionForm = unknowns.filter((u) => u.diligence_question.includes("?")).length;
  add(
    "unknowns-4-to-10-with-substantive-asks",
    unknowns.length >= 4 && unknowns.length <= 10 && substantive,
    `${unknowns.length} unknowns, ${questionForm} phrased as questions`
  );

  // 10. Plain-language summaries exist and differ from technical summaries
  const plainOk = [d.business_model, d.financial_picture, d.investment_angle].every(
    (s) => s.plain_language_summary.trim().length > 40 && s.plain_language_summary !== s.summary
  );
  add("plain-language-summaries-distinct", plainOk);

  // 11. Self-critique engaged: critique produced findings and revision changed the dossier
  const critiqued = result.critique.findings.length;
  const changed = JSON.stringify(result.draft) !== JSON.stringify(result.final);
  add(
    "self-critique-engaged",
    critiqued > 0 && (changed || result.critique.findings.every((f) => f.severity === "low")),
    `${critiqued} findings; revision ${changed ? "changed" : "did not change"} the dossier`
  );

  // 12. Legitimacy: no obviously fabricated source markers in sources_and_notes
  const allSources = [
    ...d.business_model.sources_and_notes,
    ...d.ownership_control.sources_and_notes,
    ...d.financial_picture.sources_and_notes,
    ...d.capital_structure_health.sources_and_notes,
    ...d.investment_angle.sources_and_notes,
  ].join(" ");
  const suspicious = /(retrieved from|accessed at) https?:\/\//i.test(allSources);
  add("no-fabricated-source-urls", !suspicious);

  return checks;
}
