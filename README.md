# WBA Company Intelligence

Company-analysis app whose value lives in one component: the **reasoning engine** that turns sparse public data into a confidence-tagged investment dossier. Everything else is plumbing. The UI is deliberately unstyled until a separate design pass.

## Status: Phase 1 (engine on hand-fed data)

Built: inference chains, 7-section structured dossier schema, confidence logic, lens system, self-critique (red-team) pass, reasoning traces, eval harness, functional input/output UI.

Not yet built (later phases, in order): Supabase auth + per-user data (2), scoped chatbot (3), live registry data (4), PDF export (5). See `docs/SPEC.md`.

## Run it

```sh
npm install
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                        # http://localhost:3000
```

Paste registry extracts / filings / website text / press into the box, pick a lens, analyse. The engine runs three passes (draft → red-team critique → revise), which takes a few minutes. Every run writes a full reasoning trace to `traces/`.

## The engine is the product — where to iterate

All judgment lives in editable, version-controlled config under `engine/config/`:

| Path | What it is |
|---|---|
| `system-prompt.md` | Analyst persona, the five principles, calibration discipline |
| `chains/*.md` | The inference chains (revenue, margin, capital structure, owner motivation, exit, moat). Add a chain by copying `_TEMPLATE.md`; files load in filename order |
| `prompts/critique.md` | The red-team reviewer pass |
| `prompts/revise.md` | The revision pass |
| `prompts/output-instructions.md` | Field-level output discipline |
| `schema/dossier.schema.json` | The 7-section structured output (API-enforced). Mirror changes in `engine/src/types.ts` |
| `lenses/*.json` | Investor / Entrepreneur / Curious presentation transforms |
| `models.json` | Model, max tokens, effort per pass — the model-agnostic knob |

Every trace and eval run records a `configFingerprint` (hash of all the above) so output quality is attributable to a config version.

## Eval harness — measure before and after every chain edit

```sh
npm run eval                 # run engine on all test companies (engine/evals/companies/)
npm run eval -- alpenstahl   # one company
npm run eval -- --draft-only # skip critique+revise (cheap iteration)
npm run eval:checks          # re-run structural checks on the latest run, no LLM calls
npm run eval:list            # list companies and past runs
```

Outputs land in `engine/evals/runs/<timestamp>_<fingerprint>/` — pretty-printed JSON, made for diffing across config versions. Each test company carries `humanReviewHints`: the analytical conclusions a sharp human would reach, to judge the dossier against. The structural checks catch discipline regressions (missing confidence, padded deal-killers, lazy unknowns); analytical sharpness is judged by a human against the hints.

## Hard rules enforced throughout

- Public + lawfully-held data only; no fabricated sources (system prompt + critique pass + structural check).
- Every estimate shows confidence + inference path; estimates are never dressed as facts.
- "What we don't know" is mandatory in every dossier.
