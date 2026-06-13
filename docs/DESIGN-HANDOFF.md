# Design handoff — WBA Company Intelligence

For the design pass (Claude Design or a designer). The app is **fully functional but deliberately unstyled** — raw HTML elements, no CSS framework, no design system. Everything below works today at https://wba-company-intel.vercel.app. Your job is to skin it, not to change behaviour.

## Architectural contract (please preserve)

- **Logic and presentation are separated.** Page components fetch and hold state; `engine/src/lens.ts` decides ordering/depth/emphasis; the rendering components consume that. Restyling should be CSS + component-skin work, not logic rewrites.
- **The dossier is structured data** (`engine/src/types.ts` → `Dossier`), not prose. Seven sections, every estimate carries `confidence` (high/medium/low) + `basis` (filed_fact / estimate / inference / user_provided) + an `inference_path`. The confidence badge and basis tag are the soul of the product — they must stay visible and legible, never decorative.
- **Three lenses × their views** reshape the *same* dossier (no re-analysis):
  - Investor → **Espresso** (2-min plain), **Boardroom** (numbers + conclusions), **Deep Dive** (every method/path/source)
  - Entrepreneur → **Shop Floor** (full operator view)
  - Curious → **Coffee Chat** (plain language, no jargon)
- **Unstyled by mandate so far** — do not assume any existing class names or layout are intentional; they are placeholders.

## Brand / tone starting point (not prescriptive)

Audience: investors, entrepreneurs, principals — serious but **not** Bloomberg-terminal people. The product's promise is *trustworthy judgment under uncertainty*. Visual language should feel like a sharp analyst's private brief: confident, calm, legible, quietly premium. Confidence levels want a clear visual scale (e.g. high/medium/low). Avoid fintech-cliché (purple gradients, neon, dense dashboards). The placeholder icon uses ink-navy `#1a1a2e` + a teal accent `#4a9` — treat as a hint, not a rule.

## Surfaces (every screen, in nav order)

| Route | Purpose | Key states to design |
|---|---|---|
| `/login` | Invite-only email+password sign-in. No signup, no email reset. | idle / submitting / error (bad credentials) |
| `/` | **Home = companies dashboard.** Table of companies + "Research a new company" CTA. | empty (no companies) / populated / loading / delete-confirm |
| `/analyse` | **Guided 3-step research flow.** Step 1 who (name, country, listed+ticker) → Step 2 get data (fetch button streaming into a textarea, collapsed options, private notes) → Step 3 run & read. | per-step; **gathering** (streaming); **analysing** (live pass-by-pass progress + elapsed timer); result; error+retry |
| `/companies/[id]` | **Company hub:** financial model panel + time-stamped dossier list + private notes. | no model yet (seed/blank CTA) / model populated / no dossiers |
| `/dossiers/[id]` | **Dossier reader (reader-first):** lens+view switcher, the 7 sections, chat, then a collapsed "Engine room" (critique + trace). | reading / editing inline / chat streaming / saved |
| `/dossiers/[id]/export` | **PDF export config:** variant (Long/Short/Visual) + lens + sections + branding line; live print preview. | config / print preview (print CSS already hides controls) |
| `/settings` | Source preferences (toggle data sources on/off). | list of sources with enabled toggles |
| `/account` | Change password. | idle / saving / saved / error |

## Components & their states

- **`Nav.tsx`** — top nav (My companies · Research · Source preferences · Account · Sign out). Shown only when logged in.
- **`DossierView.tsx`** — the dossier renderer. Sections are collapsible (`<details>`); section order/emphasis/expansion from the lens. Contains:
  - **`ConfidenceBadge`** — clickable, reveals the rationale. *The* signature element — design its 3 levels carefully.
  - **Estimate rows** — value + basis tag + confidence badge + "how was this derived?" (inference path, methods, cross-checks, caveats) + inline value override (with "your override — engine said X / reset").
  - **`EditableText`** (`EditableText.tsx`) — any summary/conclusion/key-point: pencil to edit, "(edited [date] · revert)" marker, original preserved. States: display / editing / edited.
  - Conclusions block: investment thesis, owner-motivation read, moat, exit thesis, **2–3 deal-killers** (with severity), verdict.
  - "What we don't know": ranked diligence table + "copy all questions" button.
  - **`CritiquePanel`** — the red-team findings table (severity / section / issue / detail / fix). Lives in the collapsed "Engine room".
- **`ChatPanel.tsx`** — company-scoped chat. States: empty / user msg / assistant streaming ("thinking…" → tokens) / error. Messages are plain text with markdown-ish content.
- **`ModelPanel.tsx`** — the financial model. Dense and important. Sub-areas: assumptions (base year/revenue/net debt/horizon + deal inputs), Bear/Base/Bull scenario grid (editable cells), scenario outcomes table, per-scenario year-by-year tables, **growth × multiple sensitivity matrix** (toggle EV/equity — a heatmap is the obvious design opportunity), editable peer-comp table, and a promptable-metrics area (textarea → streamed answer → saved collapsible list). States: no model (seed/blank) / populated / unsaved-changes / saving / computing-metrics.
- **`ExportView.tsx`** — print/PDF document for the 3 variants. Has print CSS; needs print-appropriate typography. Includes a plain-SVG projection bar chart in the Visual variant.

## Cross-cutting state patterns to style once

- **Confidence levels** (high/medium/low) — appears hundreds of times.
- **Basis tags** (filed fact / estimate / inference / user provided) — the fact-vs-estimate distinction is a core honesty signal.
- **Edited / overridden markers** — "this differs from what the engine said".
- **Streaming** — gather, chat, metrics, and the analysis progress all stream; design a consistent "live" treatment.
- **Long waits** — analysis is 5–10 min with pass-by-pass progress (Drafting → Red-teaming → Revising). This is the make-or-break moment for "does the product feel alive".
- **Loading / empty / error** — every data surface.

## Sample content for designing against

Real dossier JSON (use as realistic content, not lorem ipsum): `engine/evals/runs/<latest>/*.dossier.json` and `*.result.json` (includes the critique + trace). The Alpenstahl dossier is complete; Brightpath/Edelweiss to be added once the API limit clears.

## Constraints

- Mobile + desktop (installable PWA — runs in a standalone window with no browser chrome; design for that too).
- Keep all current functionality reachable; if you move something, it must still exist.
- Don't introduce a component library without checking — the maintainer iterates the engine config constantly and values low churn in app code.
