# KnowBro — Design System & Brand Book

> **We looked into it.** KnowBro is an interactive company-intelligence platform
> for investors, entrepreneurs, and informed decision-makers who need deep company
> analysis without investment-banking expertise.

This repository **is** the design system. It is read by an automated compiler that
bundles the components into a runtime library and indexes the tokens. Everything a
designer or agent needs to produce on-brand KnowBro work — colors, type, logo, voice,
motion, components — lives here.

---

## 1. What KnowBro is

KnowBro builds **dynamic in-app dossiers** on companies. It goes beyond public-data
retrieval: it *infers* hard-to-observe business signals — estimated revenue, margins,
leverage, owner motivation, strategic positioning, and potential exit angles.

The product's defining promise is **transparency under inference**. Every insight ships
with three things:

1. a **confidence level** (high / medium / low),
2. **source references**, and
3. a **transparent reasoning path** — how the conclusion was reached.

Core surfaces: the interactive **dossier**, a context-aware **chatbot**, **saved
searches**, collaborative **notes**, **source tracking**, **invite-only** access, and
configurable **PDF exports**.

### Design implications
- **Confidence is a first-class visual primitive.** Numbers are rarely presented bare;
  they wear a confidence chip and link to sources. The teal/amber/clay confidence scale
  is part of the brand, not a status afterthought.
- **Show the work.** Reasoning paths, citations, and provenance get real visual weight.
  The aesthetic borrows from instrumentation and analyst reports, not consumer dashboards.
- **Earned trust over hype.** The casual name ("KnowBro") is balanced by a serious,
  precise core. Wit lives in microcopy; the data presentation stays sober.

---

## 2. Sources & provenance

There was **no prior codebase, Figma, or brand**. This system was designed from scratch
in this project on the stated direction:

- Aesthetic: *modern fintech-precise — clean grotesk, sharp grids, restrained color.*
- Mood: *deep ink blues + warm-paper neutrals.*
- Type: *literary serif (à la Anthropic's serif) + technical companions.*
- Voice: *balanced — serious core, occasional personality.*
- Theme: *proper dual light/dark.*
- Logo: *technical, from scratch.*

If you later have real product screens, a codebase, or a Figma file, attach them via the
Import menu and this system can be reconciled against them.

---

## 3. Brand foundations at a glance

| Axis | Decision |
|---|---|
| **Logo** | **Disclosed-line** mark — a dossier's three data lines with the *inferred* line revealed in Signal Blue. Wordmark **`knowbro.`** set in IBM Plex Mono with a Signal-Blue dot. `assets/logo-mark.svg` |
| **Display type** | **Newsreader** (literary serif) — headlines, report titles, big statements |
| **UI / body type** | **Hanken Grotesk** (precise grotesk) — interface, paragraphs, labels |
| **Data type** | **IBM Plex Mono** — figures, confidence scores, source refs, tabular data |
| **Brand color** | **Ink Blue** `--ink-600 #1F3D68` |
| **Accent** | **Signal Blue** `--signal-500 #2E6BFF` — marks *inferred* insight |
| **Neutrals** | **Warm paper** scale (slightly warm off-whites → near-black) |
| **Confidence** | Teal `#14A37F` · Amber `#C9831F` · Clay `#C24A3A` |
| **Corners** | Sharp-leaning: 4px inputs/buttons, 6px cards, 10px panels |
| **Motion** | Quick, confident, **no bounce** — motion confirms, never performs |

---

## 4. Content fundamentals — voice & tone

KnowBro sounds like **a sharp analyst who respects your time** — precise, evidence-led,
quietly confident. The name is casual; the work is not. We earn the "Bro" by being
genuinely useful, then allow ourselves the occasional dry aside.

### Principles
- **Lead with the signal.** State the inference, then qualify it. *"Estimated revenue
  €18–24M, medium confidence — derived from headcount, filings, and sector multiples."*
- **Never overclaim.** Inference is labeled as inference. We say *"estimated,"
  "inferred," "suggests,"* and we attach confidence. We do not say *"is"* about things
  we modeled.
- **Cite by default.** Claims point to sources. "Per the 2024 filing," "based on 3 of 5
  signals."
- **You, not the user.** Address the reader as **"you."** KnowBro refers to itself
  sparingly and in first person plural only in marketing ("we"). In-product, the system
  is invisible — it presents findings, it doesn't narrate itself.
- **Plain over jargon.** Explain like the reader is smart but not an i-banker. Define a
  term the first time; don't dumb it down.
- **Dry wit, rarely.** A light touch in empty states, onboarding, and tooltips — never in
  a data field or a confidence label. Example empty state: *"No dossiers yet. Pick a
  company and we'll start digging."*

### Casing & mechanics
- **Sentence case** everywhere — headings, buttons, menus. *"Save search,"* not *"Save
  Search."* The only Title Case is proper nouns and the product name **KnowBro** (one
  word, capital K, capital B).
- **Numbers**: tabular, mono, with units. Ranges use an en-dash (€18–24M). Percentages
  and currency always carry their symbol.
- **Confidence words**: lowercase — *high / medium / low confidence*.
- **No emoji.** KnowBro does not use emoji in product or marketing. Iconography carries
  visual meaning; emoji would undercut the analytical tone.
- **Oxford comma**: yes. **Voice**: active. **Tense**: present.

### Microcopy examples
| Context | Copy |
|---|---|
| Primary CTA | `Build dossier` |
| Confidence note | `Medium confidence · 3 sources` |
| Empty saved searches | `Nothing saved yet. Star a search to pin it here.` |
| Export dialog | `Choose what travels into the PDF.` |
| Inference disclaimer | `Inferred, not reported. See reasoning path.` |
| Invite gate | `KnowBro is invite-only. Have a code?` |
| Error (soft) | `Couldn't reach that source. We'll keep the rest.` |

---

## 5. Visual foundations

The KnowBro look is **precise instrumentation on warm paper**. It should feel like a
well-made analytical tool: structured, calm, evidence-forward — closer to a Bloomberg
terminal crossed with a finely-set research report than a typical SaaS dashboard.

### Color
- **Two anchors:** deep **ink blue** (authority, trust, finance) and **warm paper**
  neutrals (readability, a report feel, warmth that offsets the cool blue). Neutrals are
  deliberately *warm* (a hint of yellow), the brand blues deliberately *cool* — the
  tension is the brand.
- **Signal Blue is precious.** `--signal-500` is reserved for *inferred insight*,
  interactive accents, focus, and the logo's revealed line. Don't paint large areas with
  it; it earns attention by scarcity.
- **Confidence palette** (teal/amber/clay) is muted and grown-up, never neon. It appears
  as small chips, dots, and underlines — not big fills.
- **Dual theme.** Light is warm-paper-first (the default reading surface, reports, PDF).
  Dark is deep-ink (the focused analysis surface). Both are first-class; every component
  must work in both. Tokens flip via `[data-theme="dark"]`.

### Typography
- **Serif for voice, grotesk for interface.** Newsreader carries headlines and editorial
  statements — it gives KnowBro a literary, authoritative register. Hanken Grotesk runs
  the UI and body: precise, legible, unfussy. IBM Plex Mono handles every figure.
- **Data is always mono.** Revenue, margins, confidence %, dates, IDs, source counts —
  tabular mono, so columns align and numbers feel measured.
- **Tight display, comfortable body.** Display headings track in (-0.02em) and set tight
  (1.06). Body sets at 1.5; long-form reports at 1.65 on a ~68ch measure.
- **Eyebrows are mono uppercase**, wide-tracked — the small technical labels above
  sections.

### Space, grid & layout
- **4px base unit**; rhythm in multiples of 4. Default content gutter 24px.
- **A visible structural grid.** The blueprint grid motif (`.kb-grid-bg`, 24px) appears
  faintly behind hero and dossier surfaces — it signals construction and measurement.
- **Generous but not airy.** Fintech-precise means content-dense where data lives,
  breathing room around headlines. Avoid both cramped tables and vast empty hero space.
- **Fixed app frame:** 264px navigation rail, optional 420px dossier detail panel.

### Surfaces, borders & shadows
- **Cards** are flat-ish: 1px hairline border (`--border-subtle`) + a low ink-tinted
  shadow (`--shadow-sm`). Rounding 6px. They read as cut sheets, not floating bubbles.
- **Shadows are cool** (ink-tinted, never neutral grey) and **low** — elevation is
  communicated with a hairline + a soft drop, not a big blur.
- **Borders do real work.** Much of the structure is line-based (dividers, table rules,
  the stacked data-line motif of the mark). Hairlines over heavy fills.
- **Corners are restrained.** 2–6px on most things; pills only for avatars, toggles, and
  status dots. Nothing is bubbly.

### Motion & interaction
- **Quick and confident.** 140ms hovers, 220ms panels, no bounce, no overshoot —
  `--ease-standard` (sharp in, settled out). Motion *confirms* an action.
- **Confidence reveals** may animate deliberately (≤600ms) — a bar drawing in, a number
  counting — because that's content, not chrome. Everything else is brisk.
- **Hover:** surfaces lift to `--surface-hover` (a subtle warm/translucent step), links
  underline, buttons darken one step. **Press:** color deepens; no scale-down on buttons
  (a 0.5–1px translate at most). Primary actions never shrink.
- **Focus:** a 3px Signal-soft ring (`--ring`). Always visible, keyboard-first.
- **Reduced motion** is respected — durations collapse to 0.

### Imagery & texture
- KnowBro is **not a photo-led brand**. Its visual texture is *structural*: blueprint
  grids, stacked data lines (echoing the mark), thin connector lines for reasoning
  paths, and tabular data itself as ornament.
- When imagery is used, prefer **cool, desaturated, documentary** registers — never warm
  lifestyle stock. Charts, maps, and org graphs are more on-brand than people.
- **Transparency & blur**: used sparingly — a blurred ink overlay behind dialogs
  (`--overlay`), and subtle translucency for hover states on dark. Not a glassmorphism
  brand.

---

## 6. Iconography

- **System:** [**Lucide**](https://lucide.dev) — loaded from CDN. Chosen because its
  thin, geometric, consistent **1.5–2px stroke** matches the fintech-precise grotesk
  aesthetic and sits beside the data-line and grid motifs naturally. Outline (stroke)
  style only; no filled or duotone icons.
  ```html
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
  <i data-lucide="search"></i>
  <script>lucide.createIcons();</script>
  ```
- **Sizing:** icons render on the 4px grid — 16 / 20 / 24px. Stroke width 1.75 default
  (1.5 at ≥24px). Color inherits `currentColor`; never multicolor.
- **Brand glyphs:** the **disclosed-line** motif (from the mark) is the one bespoke
  family — a revealed Signal-Blue segment denotes inference. Used for inferred fields,
  reasoning paths, and confidence reveals. See `assets/`.
- **No emoji, ever.** No Unicode pictographs as icons. Status is shown with the
  confidence dot/chip system, not colored emoji.
- **Recommended Lucide set** for KnowBro surfaces: `search`, `file-text`, `building-2`,
  `trending-up`, `git-branch` (reasoning path), `link` (source), `bookmark`, `sparkles`
  (inference — use rarely), `shield-check` (confidence), `download`, `users`,
  `message-square`, `chevron-right`, `external-link`.

---

## 7. Logo

The mark is the **disclosed line**: three stacked, rounded data lines — a dossier on
record — where the **middle line is broken and its far segment revealed in Signal Blue**.
That blue segment is the *inferred* signal KnowBro discloses; the gap before it is what
public data leaves unknown.

- It reads as **data / a dossier**, and the geometry is deliberately **monospace and
  tabular** so it reads as measured information, not decoration.
- The **revealed segment is the only Signal Blue** in the mark — accent by scarcity.
- **Files:** `assets/logo-mark.svg` (ink lines + Signal segment, light bg),
  `assets/logo-mark-dark.svg` (paper lines, dark bg), `assets/logo-mark-mono.svg`
  (single `currentColor` for inline tinting).
- **Clear space:** keep ≈ 1 grid unit (the height of one line) clear on all sides.
  **Min size:** 20px (favicon), 24px in UI.
- **Don't:** add a fourth line, gradient-fill the lines, round the mark into a circle
  badge, or recolor the revealed segment. It stays Signal Blue in color lockups.
- **Wordmark:** **`knowbro.`** — all lowercase, **IBM Plex Mono Medium (500)**, tracking
  -0.015em, with a **Signal-Blue dot** standing in for the period. Lowercase + mono is the
  intentional "intelligence tool" register; the dot is the one accent. The product name in
  running prose is still written **KnowBro** (capital K, capital B). See the Brand cards
  for the horizontal lockup in both themes.

---

## 8. Index / manifest

Root files:
- **`styles.css`** — global entry point (imports only). Consumers link this.
- **`tokens/`** — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`,
  `radius.css`, `shadow.css`, `motion.css`, `base.css`.
- **`assets/`** — `logo-mark.svg`, `logo-mark-dark.svg`, `logo-mark-mono.svg`.
- **`guidelines/`** — foundation specimen cards (the Design System tab).
- **`readme.md`** — this brand book.
- **`SKILL.md`** — portable Agent-Skill manifest.

Built later (awaiting your go-ahead): reusable **components/** (Button, Input, Badge,
ConfidenceChip, Card, …) and product **ui_kits/** (the dossier app, the marketing site).

---

## 9. Status & open questions

- **Fonts** (Newsreader, Hanken Grotesk, IBM Plex Mono) are loaded from **Google Fonts
  CDN**, not self-hosted binaries. If you want a fully offline / self-hosted bundle, say
  so and I'll vendor the `.woff2` files and rewrite `@font-face`.
- This is **stage 1**: brand book, logo, and foundations. **Components and UI kits come
  next, on your approval.**
