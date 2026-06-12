// The financial model: pure, deterministic calculations — no LLM in the math
// path. Parameters are per company (one living model), seeded best-effort from
// the latest dossier and fully editable. All money values in millions.

import type { Dossier } from "@/engine/src/types";

export interface ScenarioParams {
  growth_pct: number; // annual revenue growth
  ebitda_margin_pct: number; // constant margin over the horizon
  exit_multiple: number; // EV/EBITDA at exit
}

export interface PeerComp {
  name: string;
  ev_ebitda: number;
  note: string;
}

export interface ModelParams {
  currency: string; // display only, e.g. "EUR"
  base_year: number;
  base_revenue_m: number;
  net_debt_m: number; // company net debt today (negative = net cash)
  horizon_years: number;
  entry_ev_m: number; // 0 = no entry assumption -> returns not computed
  debt_pct_of_entry: number; // % of entry EV funded with debt
  interest_rate_pct: number;
  cash_conversion_pct: number; // EBITDA -> FCF before interest (tax+capex+WC proxy)
  scenarios: { bear: ScenarioParams; base: ScenarioParams; bull: ScenarioParams };
  peers: PeerComp[];
}

export interface YearRow {
  year: number;
  revenue: number;
  ebitda: number;
  fcf: number; // after interest
  debt: number; // end of year, floored at 0
  cash: number; // surplus accumulated after debt repaid
  leverage: number | null; // net debt / EBITDA
}

export interface ScenarioResult {
  rows: YearRow[];
  exit_ebitda: number;
  exit_ev: number;
  exit_net_debt: number;
  exit_equity: number;
  entry_equity: number | null;
  moic: number | null;
  irr_pct: number | null;
}

export const SCENARIO_KEYS = ["bear", "base", "bull"] as const;
export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export function defaultParams(): ModelParams {
  return {
    currency: "EUR",
    base_year: new Date().getFullYear(),
    base_revenue_m: 0,
    net_debt_m: 0,
    horizon_years: 5,
    entry_ev_m: 0,
    debt_pct_of_entry: 50,
    interest_rate_pct: 6,
    cash_conversion_pct: 60,
    scenarios: {
      bear: { growth_pct: 0, ebitda_margin_pct: 8, exit_multiple: 5 },
      base: { growth_pct: 5, ebitda_margin_pct: 10, exit_multiple: 6.5 },
      bull: { growth_pct: 10, ebitda_margin_pct: 12, exit_multiple: 8 },
    },
    peers: [],
  };
}

export function runScenario(p: ModelParams, s: ScenarioParams): ScenarioResult {
  const usesEntry = p.entry_ev_m > 0;
  // Starting debt: deal debt if an entry is modelled, else today's net debt.
  let debt = usesEntry ? (p.entry_ev_m * p.debt_pct_of_entry) / 100 : Math.max(p.net_debt_m, 0);
  let cash = usesEntry ? 0 : Math.max(-p.net_debt_m, 0);

  const rows: YearRow[] = [];
  for (let t = 1; t <= p.horizon_years; t++) {
    const revenue = p.base_revenue_m * Math.pow(1 + s.growth_pct / 100, t);
    const ebitda = (revenue * s.ebitda_margin_pct) / 100;
    const interest = (debt * p.interest_rate_pct) / 100;
    const fcf = (ebitda * p.cash_conversion_pct) / 100 - interest;
    const repay = Math.min(Math.max(fcf, 0), debt);
    debt -= repay;
    cash += fcf - repay; // surplus (or drain) after mandatory paydown
    const ebitdaSafe = ebitda > 0 ? ebitda : null;
    rows.push({
      year: p.base_year + t,
      revenue,
      ebitda,
      fcf,
      debt,
      cash,
      leverage: ebitdaSafe ? (debt - cash) / ebitdaSafe : null,
    });
  }

  const last = rows[rows.length - 1];
  const exit_ev = last.ebitda * s.exit_multiple;
  const exit_net_debt = last.debt - last.cash;
  const exit_equity = exit_ev - exit_net_debt;

  let entry_equity: number | null = null;
  let moic: number | null = null;
  let irr_pct: number | null = null;
  if (usesEntry) {
    entry_equity = p.entry_ev_m - (p.entry_ev_m * p.debt_pct_of_entry) / 100;
    if (entry_equity > 0) {
      moic = exit_equity / entry_equity;
      irr_pct = moic > 0 ? (Math.pow(moic, 1 / p.horizon_years) - 1) * 100 : null;
    }
  }

  return { rows, exit_ebitda: last.ebitda, exit_ev, exit_net_debt, exit_equity, entry_equity, moic, irr_pct };
}

export interface Sensitivity {
  growths: number[];
  multiples: number[];
  /** ev[i][j] = exit EV at growths[i] x multiples[j] (base-case margin) */
  ev: number[][];
  /** equity[i][j] = exit EV minus the base-case-margin debt path's exit net debt */
  equity: number[][];
}

function spread(values: number[], steps: number): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    // degenerate: build a +-20% band around the single value
    const lo = min * 0.8;
    const hi = max * 1.2 || 1;
    return spread([lo, hi], steps);
  }
  const out: number[] = [];
  for (let i = 0; i < steps; i++) out.push(min + ((max - min) * i) / (steps - 1));
  return out;
}

export function sensitivity(p: ModelParams, steps = 5): Sensitivity {
  const sc = p.scenarios;
  const growths = spread([sc.bear.growth_pct, sc.base.growth_pct, sc.bull.growth_pct], steps);
  const multiples = spread([sc.bear.exit_multiple, sc.base.exit_multiple, sc.bull.exit_multiple], steps);
  const margin = sc.base.ebitda_margin_pct;

  const ev: number[][] = [];
  const equity: number[][] = [];
  for (const g of growths) {
    const res = runScenario(p, { growth_pct: g, ebitda_margin_pct: margin, exit_multiple: 1 });
    const evRow: number[] = [];
    const eqRow: number[] = [];
    for (const m of multiples) {
      const exitEv = res.exit_ebitda * m;
      evRow.push(exitEv);
      eqRow.push(exitEv - res.exit_net_debt);
    }
    ev.push(evRow);
    equity.push(eqRow);
  }
  return { growths, multiples, ev, equity };
}

export interface PeerValuation {
  base_ebitda: number; // base-year EBITDA at base-case margin
  rows: { name: string; ev_ebitda: number; ev: number; equity: number; note: string }[];
  median_ev: number | null;
  median_equity: number | null;
}

export function peerValuation(p: ModelParams): PeerValuation {
  const base_ebitda = (p.base_revenue_m * p.scenarios.base.ebitda_margin_pct) / 100;
  const rows = p.peers.map((peer) => {
    const ev = base_ebitda * peer.ev_ebitda;
    return { name: peer.name, ev_ebitda: peer.ev_ebitda, ev, equity: ev - p.net_debt_m, note: peer.note };
  });
  const sorted = [...rows].sort((a, b) => a.ev - b.ev);
  const mid = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
  return {
    base_ebitda,
    rows,
    median_ev: mid ? mid.ev : null,
    median_equity: mid ? mid.equity : null,
  };
}

// ---------------------------------------------------------------------------
// Best-effort seeding from a dossier. Parsing prose numbers is inherently
// fuzzy — every seeded value is reported in `notes` so the user verifies.
// ---------------------------------------------------------------------------

export interface SeedResult {
  params: ModelParams;
  notes: string[];
}

function parseNumber(s: string): number {
  // "1.234,5" (de) and "1,234.5" (en) both -> 1234.5; "24" -> 24
  const cleaned = s.replace(/\s/g, "");
  if (/,\d{1,2}$/.test(cleaned)) return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  return parseFloat(cleaned.replace(/,/g, ""));
}

function findMostLikely(text: string): number | null {
  // "most likely ~€25m" / "midpoint ~ EUR 200m"
  let m = text.match(/(?:most likely|midpoint)[^\d€£$]*[€£$]?\s*([\d.,]+)\s*m/i);
  if (m) return parseNumber(m[1]);
  // range "€22–32m" -> midpoint
  m = text.match(/[€£$]?\s*([\d.,]+)\s*[–—-]\s*[€£$]?\s*([\d.,]+)\s*m/i);
  if (m) return (parseNumber(m[1]) + parseNumber(m[2])) / 2;
  m = text.match(/[€£$]\s*([\d.,]+)\s*m/i);
  if (m) return parseNumber(m[1]);
  return null;
}

function findPercentRange(text: string): { mid: number; lo: number; hi: number } | null {
  let m = text.match(/([\d.,]+)\s*[–—-]\s*([\d.,]+)\s*%/);
  if (m) {
    const lo = parseNumber(m[1]);
    const hi = parseNumber(m[2]);
    return { lo, hi, mid: (lo + hi) / 2 };
  }
  m = text.match(/([\d.,]+)\s*%/);
  if (m) {
    const v = parseNumber(m[1]);
    return { lo: v, hi: v, mid: v };
  }
  return null;
}

function findMultipleRange(text: string): { lo: number; hi: number; mid: number } | null {
  const m = text.match(/([\d.,]+)\s*[–—-]\s*([\d.,]+)\s*[x×]/i);
  if (m) {
    const lo = parseNumber(m[1]);
    const hi = parseNumber(m[2]);
    return { lo, hi, mid: (lo + hi) / 2 };
  }
  const single = text.match(/([\d.,]+)\s*[x×]/i);
  if (single) {
    const v = parseNumber(single[1]);
    return { lo: v, hi: v, mid: v };
  }
  return null;
}

export function seedFromDossier(dossier: Dossier): SeedResult {
  const params = defaultParams();
  const notes: string[] = [];

  const allEstimates = [
    ...dossier.financial_picture.estimates,
    ...dossier.capital_structure_health.estimates,
    ...dossier.investment_angle.estimates,
    ...dossier.business_model.estimates,
  ];

  const revenueEst = allEstimates.find((e) => /revenue|turnover|umsatz/i.test(e.id));
  if (revenueEst) {
    const v = findMostLikely(revenueEst.value);
    if (v) {
      params.base_revenue_m = Math.round(v * 10) / 10;
      notes.push(`Base revenue ${params.base_revenue_m}m seeded from "${revenueEst.label}" (${revenueEst.value}).`);
    }
    if (/£/.test(revenueEst.value)) params.currency = "GBP";
    else if (/\$/.test(revenueEst.value)) params.currency = "USD";
  }
  if (!params.base_revenue_m) notes.push("Base revenue could not be parsed from the dossier — set it manually.");

  const marginEst = allEstimates.find((e) => /margin/i.test(e.id));
  if (marginEst) {
    const r = findPercentRange(marginEst.value);
    if (r) {
      params.scenarios.bear.ebitda_margin_pct = Math.round(r.lo * 10) / 10;
      params.scenarios.base.ebitda_margin_pct = Math.round(r.mid * 10) / 10;
      params.scenarios.bull.ebitda_margin_pct = Math.round(r.hi * 10) / 10;
      notes.push(`EBITDA margins ${r.lo}/${r.mid.toFixed(1)}/${r.hi}% seeded from "${marginEst.label}".`);
    }
  } else {
    notes.push("EBITDA margin not found — scenario margins are defaults.");
  }

  const valEst = allEstimates.find((e) => /valuation|multiple|ev[-_]/i.test(e.id));
  if (valEst) {
    const r = findMultipleRange(valEst.value + " " + valEst.inference_path.join(" "));
    if (r) {
      params.scenarios.bear.exit_multiple = r.lo;
      params.scenarios.base.exit_multiple = Math.round(r.mid * 10) / 10;
      params.scenarios.bull.exit_multiple = r.hi;
      notes.push(`Exit multiples ${r.lo}/${r.mid.toFixed(1)}/${r.hi}x seeded from "${valEst.label}".`);
    }
  } else {
    notes.push("No valuation multiple found in the dossier — exit multiples are defaults.");
  }

  notes.push("Net debt defaults to 0 — set it from the capital-structure section (the model cannot safely parse it).");
  notes.push("Growth rates are generic defaults (0/5/10%) — set them to your view of this company.");

  return { params, notes };
}
