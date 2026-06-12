<!-- version: 1 -->
# Output requirements (appended to the analysis system prompt)

Produce the dossier as structured JSON following the schema enforced on your output. Field-level discipline:

- `snapshot.one_liner`: what the company is and the single most decision-relevant fact, one sentence.
- `snapshot.overall_confidence`: the confidence of the dossier *as a whole* — usually the confidence of its weakest load-bearing estimate, not an average.
- Every section: `summary` (analyst-grade, 2–4 sentences), `plain_language_summary` (genuinely plain, no jargon), `analysis` (the full reasoning, markdown allowed), `key_points`, `estimates`, `confidence`, `sources_and_notes` (which provided data you relied on, and any benchmark you imported from general knowledge — labelled as such).
- Estimates: `id` is a short stable slug (`revenue-2024e`, `ebitda-margin`, `leverage-multiple`...). `value` is human-readable with units and period ("€9–13m (FY2024e)"). `methods` lists each method actually run, one string per method in exactly this format: `Method: <name> | Inputs: <inputs you used> | Logic: <the reasoning> | Result: <the method's result>`. `reconciliation` explains how you combined them. `inference_path` is the step-by-step chain a reader clicks open — each step one clear sentence.
- `conclusions` holds the decisive cross-section calls (the UI renders each inside its home section):
  - `owner_motivation_read`: what the owner probably wants, timeframe, deal implication — committed, not hedged.
  - `health_verdict`: the capital-structure health call.
  - `moat_assessment` and `exit_thesis`: the moat verdict and the acquirer map / ranked exit routes.
  - `deal_killers`: exactly 2 or 3, each with a one-line rationale and severity. These are the risks that would genuinely kill the deal, not generic risks.
  - `verdict`: the decisive bottom line, 2–4 sentences, written like you have to defend it on Monday.
- `what_we_dont_know.items`: 4–10 gaps, each with why it matters and the concrete diligence question to ask. Order by importance.
- Do not pad. Empty-string or empty-array is correct where a field genuinely has nothing (rare).
