<!-- version: 1 -->
# Output requirements (appended to the analysis system prompt)

Produce the dossier as structured JSON following the schema enforced on your output. Field-level discipline:

- `snapshot.one_liner`: what the company is and the single most decision-relevant fact, one sentence.
- `snapshot.overall_confidence`: the confidence of the dossier *as a whole* — usually the confidence of its weakest load-bearing estimate, not an average.
- Every section: `summary` (analyst-grade, 2–4 sentences), `plain_language_summary` (genuinely plain, no jargon), `analysis` (the full reasoning, markdown allowed), `key_points`, `estimates`, `confidence`, `sources_and_notes` (which provided data you relied on, and any benchmark you imported from general knowledge — labelled as such).
- Estimates: `id` is a short stable slug (`revenue-2024e`, `ebitda-margin`, `leverage-multiple`...). `value` is human-readable with units and period ("€9–13m (FY2024e)"). `methods` lists each method actually run with its inputs and result; `reconciliation` explains how you combined them. `inference_path` is the step-by-step chain a reader clicks open — each step one clear sentence.
- `investment_angle.deal_killers`: exactly 2 or 3, each with a one-line rationale and severity. These are the risks that would genuinely kill the deal, not generic risks.
- `investment_angle.verdict`: the decisive bottom line, 2–4 sentences, written like you have to defend it on Monday.
- `what_we_dont_know.items`: 4–10 gaps, each with why it matters and the concrete diligence question to ask. Order by importance.
- Do not pad. Empty-string or empty-array is correct where a field genuinely has nothing (rare).
