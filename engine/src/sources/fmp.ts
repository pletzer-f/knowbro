// Financial Modeling Prep — free tier: 250 calls/day, limited bandwidth.
// Designed to be frugal: exactly 3 small calls per listed company, all
// day-cached on disk (same company same day = zero API calls).
// Key: register free at financialmodelingprep.com, set FMP_API_KEY in .env.local.

import { cachedJson } from "./cache";

const BASE = "https://financialmodelingprep.com/api/v3";

export function fmpConfigured(): boolean {
  return !!process.env.FMP_API_KEY;
}

interface FmpProfile {
  symbol: string;
  companyName: string;
  currency: string;
  exchangeShortName: string;
  industry: string;
  sector: string;
  country: string;
  marketCap: number;
  price: number;
  beta: number;
  lastDiv: number;
  fullTimeEmployees: string;
}

interface FmpKeyMetrics {
  enterpriseValueTTM: number;
  evToSalesTTM: number;
  enterpriseValueOverEBITDATTM: number;
  peRatioTTM: number;
  freeCashFlowYieldTTM: number;
  netDebtToEBITDATTM: number;
  roicTTM: number;
}

interface FmpRatios {
  grossProfitMarginTTM: number;
  operatingProfitMarginTTM: number;
  netProfitMarginTTM: number;
  currentRatioTTM: number;
  debtEquityRatioTTM: number;
}

const key = () => process.env.FMP_API_KEY!;
const pct = (v: number | null | undefined) => (v == null ? "n/a" : `${(v * 100).toFixed(1)}%`);
const num = (v: number | null | undefined, d = 1) => (v == null ? "n/a" : v.toFixed(d));
const bn = (v: number | null | undefined) =>
  v == null ? "n/a" : Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)}bn` : `${(v / 1e6).toFixed(0)}m`;

/** Market snapshot block for one listed ticker — 3 API calls, day-cached. */
export async function fmpBlock(ticker: string, todayIso: string): Promise<string | null> {
  if (!fmpConfigured()) return null;
  const t = ticker.toUpperCase();

  const [profiles, metrics, ratios] = await Promise.all([
    cachedJson<FmpProfile[]>("fmp", `${BASE}/profile/${t}?apikey=${key()}`),
    cachedJson<FmpKeyMetrics[]>("fmp", `${BASE}/key-metrics-ttm/${t}?apikey=${key()}`),
    cachedJson<FmpRatios[]>("fmp", `${BASE}/ratios-ttm/${t}?apikey=${key()}`),
  ]);
  const p = profiles?.[0];
  if (!p) return null;
  const m = metrics?.[0];
  const r = ratios?.[0];

  const lines: string[] = [];
  lines.push(`FINANCIAL MODELING PREP — MARKET DATA (financialmodelingprep.com, retrieved ${todayIso}):`);
  lines.push(
    `${p.companyName} (${p.symbol}, ${p.exchangeShortName}), ${p.sector} / ${p.industry}, ${p.country}. ` +
      `Employees: ${p.fullTimeEmployees || "n/a"}. Price ${num(p.price, 2)} ${p.currency}, ` +
      `market cap ${bn(p.marketCap)} ${p.currency}.`
  );
  if (m) {
    lines.push(
      `Valuation (TTM): EV ${bn(m.enterpriseValueTTM)} | EV/EBITDA ${num(m.enterpriseValueOverEBITDATTM)} | ` +
        `EV/Sales ${num(m.evToSalesTTM)} | P/E ${num(m.peRatioTTM)} | FCF yield ${pct(m.freeCashFlowYieldTTM)} | ` +
        `Net debt/EBITDA ${num(m.netDebtToEBITDATTM)} | ROIC ${pct(m.roicTTM)}`
    );
  }
  if (r) {
    lines.push(
      `Margins (TTM): gross ${pct(r.grossProfitMarginTTM)} | operating ${pct(r.operatingProfitMarginTTM)} | ` +
        `net ${pct(r.netProfitMarginTTM)}. Current ratio ${num(r.currentRatioTTM, 2)}, debt/equity ${num(r.debtEquityRatioTTM, 2)}.`
    );
  }
  return lines.join("\n");
}

/** Compact multiples for a small set of peer tickers (1 cached call each). */
export async function fmpPeerMultiples(tickers: string[], todayIso: string): Promise<string | null> {
  if (!fmpConfigured() || tickers.length === 0) return null;
  const limited = tickers.slice(0, 5); // frugality cap
  const rows: string[] = [];
  for (const t of limited) {
    try {
      const metrics = await cachedJson<FmpKeyMetrics[]>(
        "fmp",
        `${BASE}/key-metrics-ttm/${t.toUpperCase()}?apikey=${key()}`
      );
      const m = metrics?.[0];
      if (m) {
        rows.push(
          `- ${t.toUpperCase()}: EV/EBITDA ${num(m.enterpriseValueOverEBITDATTM)} | EV/Sales ${num(m.evToSalesTTM)} | P/E ${num(m.peRatioTTM)}`
        );
      }
    } catch {
      rows.push(`- ${t.toUpperCase()}: lookup failed`);
    }
  }
  if (rows.length === 0) return null;
  return `LISTED PEER MULTIPLES — FMP (TTM, retrieved ${todayIso}):\n${rows.join("\n")}`;
}
