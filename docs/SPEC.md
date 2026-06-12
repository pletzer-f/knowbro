# Project brief (condensed from the owner's build prompt, 2026-06-12)

## The one thing that matters

~90% of effort goes into the **reasoning-and-judgment engine** (inference chains, confidence logic, lens system, prompts, self-critique). ~10% into functional scaffolding. **Do not style the interface** — design is produced separately later; keep logic/presentation cleanly separated so restyling is easy.

## Product

Interactive company-intelligence app for people who need analytical depth but are not bankers. Not data retrieval — **inference**: estimating the unobservable (revenue, margin, leverage, owner motivation, exit angle) from legitimate public signals, always with confidence + reasoning path. Interactive in-app dossier (not a static doc), context-aware chatbot, configurable PDF export. Invite-only, multi-user, per-user saved searches/notes/source preferences.

## Engine principles (non-negotiable)

1. Inference over retrieval — never leave a key variable blank without an attempt + confidence tag.
2. Confidence mandatory and visible (high/med/low + inference path). Never present an estimate as a fact.
3. Name the unknowns — dedicated section = the user's data-room questions.
4. Legitimacy boundary (hard rule): public data + user's lawfully-held knowledge only. No restricted-register scraping, no fabricated sources.
5. Decisive, not hedged.

## Inference chains (the IP — structured, versioned, easily added to)

Revenue (employees × sector benchmark, cross-checked vs assets/bands/footprint, reconciled), margin (sector comparables adjusted for size/positioning), capital structure & health (charges register, filing punctuality, distress signals), owner motivation (founder age/succession/family-vs-institutional/PE fund-vintage logic: fund past ~year 5 of 10 = likely forced seller), exit angle (natural strategic acquirers + realistic routes), moat (what protects economics, durability, threats). Each chain shows inputs, logic, output, confidence, what would raise confidence.

## Output: fixed 7 sections (structured data, not prose blob)

1. Snapshot & overall confidence · 2. Business model · 3. Ownership & control (incl. motivation read) · 4. Financial picture (filed where available, estimated-with-bands where not) · 5. Capital structure & health · 6. Investment angle (moat, cash, leverage headroom, exit thesis, **2–3 deal-killers**) · 7. What we don't know. Each section carries its own confidence and source/inference notes.

## Lens system

One engine output; lens (Investor / Entrepreneur / Curious) is a transformation/presentation layer changing emphasis, depth, ordering, and language — not separate pipelines.

## Self-critique

Red-team pass on the draft before finalising: attack estimates, check confidence honesty, no fact-dressing, unknowns completeness. Inspectable in the UI. First-class part of the engine.

## Engineering requirements

Prompts/chains/lenses/schema in version-controlled editable config (they ARE the product). Model-agnostic call site. Full reasoning trace logged per dossier. Eval harness with hand-fed test companies to compare outputs as chains are refined.

## Build order (strict)

1. **Engine on hand-fed data** (current) — then STOP and have the owner judge engine quality before proceeding.
2. Auth + data model: Supabase invite-only (owner provisions accounts; no public signup), RLS per-user isolation (non-negotiable), saved dossiers (+ traces + overrides), per-company private notes (reusable as engine input), source preferences (declined sources excluded from future pulls).
3. Chatbot: scoped to current company, has dossier + sources + traces in context, held to engine standards.
4. Live data: UK Companies House (free API, AI extraction of scanned PDFs) → DACH (Bundesanzeiger, Firmenbuch via lawful wrappers) → S&P Global connector for listed-comparable benchmarks (supporting input, never the spine). Honour per-user source prefs + legitimacy boundary.
5. PDF export: Long (full, all inference paths) / Short (snapshot + investment angle + gaps) / Visual (chart-led). Lens, sections, branding chosen at export time.

## Definition of done (v1)

Login (invite-only) → paste data → choose lens → confidence-tagged structured dossier with inspectable inference paths and overridable estimates → chatbot follow-ups → save with private notes → source preferences → Long/Short/Visual PDF. Interface unstyled and functional. Engine demonstrably better than a smart non-banker's first pass.
