# WBA Company Intelligence

Company-analysis app whose value lives in one component: the **reasoning engine** that turns sparse public data into a confidence-tagged investment dossier. Everything else is plumbing. The UI is deliberately unstyled until a separate design pass.

## Status: Phase 3 complete (engine + auth + per-user data + chat)

Phase 1: inference chains, 7-section structured dossier schema, confidence logic, lens system with depth views (investor: Espresso / Boardroom / Deep Dive), self-critique (red-team) pass, reasoning traces, eval harness, functional input/output UI.

Phase 2: Supabase invite-only auth (email+password, owner provisions accounts — no public signup), per-user data isolated by row-level security, saved dossiers (full output + trace + persisted estimate overrides), private per-company notes (auto-reused as engine input), source preferences (stored now, enforced by the Phase 4 pull layer).

Phase 3: company-scoped chatbot on fresh results and saved dossiers — full dossier + source data + red-team critique in context, held to engine standards (confidence-tagged, inference shown, legitimacy boundary). Conversations persist per saved dossier; pre-save chat is carried over on save. Prompt lives in `engine/config/prompts/chat.md`; model/effort in `models.json` (`chat` pass).

Phase 4 (live data): "Fetch public data" on the analyse page — a web-research gather pass (server-side search/fetch through the Anthropic API, no extra keys; works for any country; legitimacy boundary in `engine/config/prompts/gather.md`) plus the official UK Companies House connector (free API; set `COMPANIES_HOUSE_API_KEY`). Optionally collects listed-peer multiples for the model. Everything honours per-user source preferences and streams into the paste box for review before analysing. Plus: "My Companies" with one living financial model per company (Bear/Base/Bull, EV sensitivity, IRR/MoIC, debt paydown, peer comps, promptable metrics) and in-dossier editing with originals preserved.

Not yet built: PDF export (5), then the post-v1 roadmap (living dossier deltas, calibration tracking, forced-seller radar). See `docs/SPEC.md`.

Supabase project: `wba-company-intel` (`iwqbymyponrhluousixb`, eu-central-1). Provision users at Dashboard → Authentication → Users → Add user (auto-confirm on).

## Run it

```sh
npm install
cp .env.local.example .env.local   # add ANTHROPIC_API_KEY + Supabase URL/key
npm run dev                        # http://localhost:3000 (sign in first)
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
| `schema/dossier.schema.json` | The 7-section structured output (API-enforced). Mirror changes in `engine/src/types.ts`. **Sits near the API's grammar-size limit** — see the `$comment` at the top of the file before restructuring; test edits with a cheap `max_tokens: 16` request |
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
