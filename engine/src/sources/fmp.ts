// Financial Modeling Prep — free tier (2026 rules): the /stable/profile
// endpoint is symbol-unrestricted; fundamentals/multiples endpoints are
// premium-gated (or demo-whitelisted) and are NOT used here. So this
// connector contributes the market snapshot — price, market cap, sector,
// employees — and the engine combines it with EDGAR's audited debt/cash to
// reason about EV, while peer multiples come from web research.
// Frugal by design: 1 call per company, day-cached (free tier: 250 calls/day).
// Key: FMP_API_KEY in .env.local.

import { cachedJson } from "./cache";

const BASE = "https://financialmodelingprep.com/stable";

export function fmpConfigured(): boolean {
  return !!process.env.FMP_API_KEY;
}

interface FmpProfile {
  symbol: string;
  companyName: string;
  price: number;
  marketCap: number;
  beta: number;
  lastDividend: number;
  range: string;
  currency: string;
  exchange: string;
  industry: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  ipoDate: string;
  isin: string;
}

const num = (v: number | null | undefined, d = 2) => (v == null ? "n/a" : v.toFixed(d));
const bn = (v: number | null | undefined) =>
  v == null ? "n/a" : Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)}bn` : `${(v / 1e6).toFixed(0)}m`;

/** Market snapshot for one listed ticker — 1 API call, day-cached. */
export async function fmpBlock(ticker: string, todayIso: string): Promise<string | null> {
  if (!fmpConfigured()) return null;
  const t = ticker.toUpperCase();
  const profiles = await cachedJson<FmpProfile[]>(
    "fmp",
    `${BASE}/profile?symbol=${encodeURIComponent(t)}&apikey=${process.env.FMP_API_KEY}`
  );
  const p = Array.isArray(profiles) ? profiles[0] : null;
  if (!p) return null;

  return [
    `MARKET SNAPSHOT — FMP (financialmodelingprep.com, retrieved ${todayIso}):`,
    `${p.companyName} (${p.symbol}, ${p.exchange}), ${p.sector} / ${p.industry}, ${p.country}. ` +
      `ISIN ${p.isin || "n/a"}. Employees: ${p.fullTimeEmployees || "n/a"}. IPO: ${p.ipoDate || "n/a"}.`,
    `Share price ${num(p.price)} ${p.currency} (52w range ${p.range || "n/a"}), ` +
      `MARKET CAP ${bn(p.marketCap)} ${p.currency}, beta ${num(p.beta)}, last dividend ${num(p.lastDividend)}.`,
    `[Note: EV and multiples are not in this feed — combine market cap with filed net debt ` +
      `(e.g. from the SEC EDGAR block) to derive EV; peer multiples come from web research.]`,
  ].join("\n");
}
