// TypeScript mirrors of engine/config/schema/*.json. If you change a schema,
// change the matching type here — the schema is what the API enforces; these
// types are what the app code relies on.

export type ConfidenceLevel = "high" | "medium" | "low";
export type Basis = "filed_fact" | "estimate" | "inference" | "user_provided";

export interface Confidence {
  level: ConfidenceLevel;
  rationale: string;
}

export interface Estimate {
  id: string;
  label: string;
  value: string;
  basis: Basis;
  /** One string per method run: "Method: <name> | Inputs: ... | Logic: ... | Result: ...".
   *  Kept as flat strings — nested method objects push the structured-output
   *  schema over the API's grammar-size limit (see dossier.schema.json $comment). */
  methods: string[];
  reconciliation: string;
  inference_path: string[];
  cross_checks: string[];
  confidence: Confidence;
  what_would_raise_confidence: string[];
  caveats: string[];
}

export interface SectionCore {
  summary: string;
  plain_language_summary: string;
  analysis: string;
  key_points: string[];
  estimates: Estimate[];
  confidence: Confidence;
  sources_and_notes: string[];
}

export interface KeyNumber {
  label: string;
  value: string;
  basis: Basis;
}

export interface Snapshot {
  one_liner: string;
  headline_view: string;
  key_numbers: KeyNumber[];
  overall_confidence: Confidence;
}

export interface DealKiller {
  title: string;
  rationale: string;
  severity: "fatal_if_confirmed" | "serious" | "manageable";
}

export interface UnknownItem {
  gap: string;
  why_it_matters: string;
  diligence_question: string;
  how_to_resolve: string;
}

/** Section-spanning decisive conclusions. Lives at the top level of the schema
 *  (instead of inside the sections) to keep the structured-output grammar small;
 *  the UI renders each field inside its home section. */
export interface Conclusions {
  owner_motivation_read: string;
  health_verdict: "healthy" | "stretched" | "distress_signals_present" | "insufficient_data";
  moat_assessment: string;
  /** The affirmative case: why own this company, the value-creation path. */
  investment_thesis: string;
  exit_thesis: string;
  deal_killers: DealKiller[];
  verdict: string;
}

export interface Dossier {
  company_name: string;
  data_period_note: string;
  snapshot: Snapshot;
  business_model: SectionCore;
  ownership_control: SectionCore;
  financial_picture: SectionCore;
  capital_structure_health: SectionCore;
  investment_angle: SectionCore;
  conclusions: Conclusions;
  what_we_dont_know: {
    summary: string;
    plain_language_summary: string;
    items: UnknownItem[];
  };
}

export type SectionKey =
  | "snapshot"
  | "business_model"
  | "ownership_control"
  | "financial_picture"
  | "capital_structure_health"
  | "investment_angle"
  | "what_we_dont_know";

export const SECTION_KEYS: SectionKey[] = [
  "snapshot",
  "business_model",
  "ownership_control",
  "financial_picture",
  "capital_structure_health",
  "investment_angle",
  "what_we_dont_know",
];

export interface CritiqueFinding {
  id: string;
  target_section: SectionKey | "conclusions" | "cross_section";
  target_estimate_id: string;
  issue_type:
    | "weak_inference"
    | "inflated_confidence"
    | "deflated_confidence"
    | "fact_dressing"
    | "missing_unknown"
    | "missing_cross_check"
    | "internal_inconsistency"
    | "indecisive"
    | "legitimacy_concern"
    | "fabricated_input"
    | "missed_input"
    | "other";
  detail: string;
  severity: ConfidenceLevel;
  recommended_fix: string;
}

export interface Critique {
  findings: CritiqueFinding[];
  overall_assessment: string;
}

/** A view is a depth/voice level within a lens (e.g. investor: Espresso /
 *  Boardroom / Deep Dive). Same dossier, same lens ordering — different
 *  detail and language. */
export interface LensView {
  id: string;
  /** The display name — deliberately fun, e.g. "Espresso". */
  label: string;
  tagline: string;
  summary_field: "summary" | "plain_language_summary";
  /** brief = summaries + headline estimates; standard = + key points;
   *  full = + full analysis text, sources, method detail. */
  detail: "brief" | "standard" | "full";
  show_method_detail: boolean;
  show_inference_paths_by_default: boolean;
}

export interface LensConfig {
  id: string;
  label: string;
  audience_description: string;
  section_order: SectionKey[];
  sections_expanded: SectionKey[];
  section_emphasis: Partial<Record<SectionKey, "high" | "normal" | "low">>;
  intro_note: string;
  /** At least one; the first is the default. */
  views: LensView[];
}

export interface AnalysisInput {
  companyName: string;
  rawData: string;
  userNotes?: string;
}

export interface PassUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface TraceStep {
  pass: "draft" | "critique" | "revise";
  model: string;
  startedAt: string;
  durationMs: number;
  systemPrompt: string;
  userPrompt: string;
  output: unknown;
  usage: PassUsage;
}

export interface AnalysisResult {
  traceId: string;
  input: AnalysisInput;
  draft: Dossier;
  critique: Critique;
  final: Dossier;
  steps: TraceStep[];
  configFingerprint: string;
}
