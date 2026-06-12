// SEC EDGAR — official, free, no API key (a User-Agent header is required by
// SEC fair-access policy). Gives audited XBRL financials for US-registered
// companies, deterministically and at zero token cost.

import { cachedJson } from "./cache";

const UA = { "User-Agent": "WBA-Company-Intel research tool (contact: fabian.pletzer@pletzer-gruppe.at)" };

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface FactPoint {
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
}

interface CompanyFacts {
  entityName: string;
  facts: { "us-gaap"?: Record<string, { units: Record<string, FactPoint[]> }> };
}

interface Submissions {
  name: string;
  sicDescription: string;
  stateOfIncorporation: string;
  filings: { recent: { form: string[]; filingDate: string[]; primaryDocDescription: string[] } };
}

export async function resolveCik(ticker: string): Promise<{ cik: string; title: string } | null> {
  const map = await cachedJson<Record<string, TickerEntry>>(
    "sec",
    "https://www.sec.gov/files/company_tickers.json",
    { headers: UA }
  );
  const hit = Object.values(map).find((e) => e.ticker.toUpperCase() === ticker.toUpperCase());
  if (!hit) return null;
  return { cik: String(hit.cik_str).padStart(10, "0"), title: hit.title };
}

// The us-gaap concepts worth extracting; first match per row wins.
const CONCEPTS: [string, string[]][] = [
  ["Revenue", ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"]],
  ["Operating income", ["OperatingIncomeLoss"]],
  ["Net income", ["NetIncomeLoss"]],
  ["Total assets", ["Assets"]],
  ["Equity", ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]],
  ["Cash & equivalents", ["CashAndCashEquivalentsAtCarryingValue"]],
  ["Long-term debt", ["LongTermDebtNoncurrent", "LongTermDebt"]],
];

function annualSeries(facts: CompanyFacts, tags: string[]): FactPoint[] {
  for (const tag of tags) {
    const units = facts.facts["us-gaap"]?.[tag]?.units;
    const usd = units?.USD;
    if (!usd) continue;
    // Annual figures from 10-K filings, deduped by fiscal year, newest first.
    const byYear = new Map<number, FactPoint>();
    for (const p of usd) {
      if (p.form === "10-K" && p.fp === "FY") byYear.set(p.fy, p);
    }
    const sorted = [...byYear.values()].sort((a, b) => b.fy - a.fy);
    // Companies switch XBRL tags over time; keep only the newest contiguous
    // era so the series doesn't silently mix decade-old figures in.
    const series = sorted.filter((p) => p.fy >= sorted[0].fy - 4).slice(0, 4);
    if (series.length) return series;
  }
  return [];
}

const bn = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}bn` : `$${(v / 1e6).toFixed(1)}m`);

/** Formatted source-pack block for one US-registered company. */
export async function secEdgarBlock(ticker: string, todayIso: string): Promise<string | null> {
  const resolved = await resolveCik(ticker);
  if (!resolved) return null;

  const [facts, subs] = await Promise.all([
    cachedJson<CompanyFacts>("sec", `https://data.sec.gov/api/xbrl/companyfacts/CIK${resolved.cik}.json`, {
      headers: UA,
    }),
    cachedJson<Submissions>("sec", `https://data.sec.gov/submissions/CIK${resolved.cik}.json`, { headers: UA }),
  ]);

  const lines: string[] = [];
  lines.push(`SEC EDGAR — OFFICIAL US FILINGS (data.sec.gov, retrieved ${todayIso}):`);
  lines.push(
    `${facts.entityName} (ticker ${ticker.toUpperCase()}, CIK ${resolved.cik}). ` +
      `SIC: ${subs.sicDescription}. State of incorporation: ${subs.stateOfIncorporation}.`
  );
  lines.push(`\nAUDITED ANNUAL FIGURES (from 10-K XBRL; filed facts, not estimates):`);
  for (const [label, tags] of CONCEPTS) {
    const series = annualSeries(facts, tags);
    if (series.length === 0) continue;
    lines.push(`- ${label}: ${series.map((p) => `FY${p.fy}: ${bn(p.val)}`).join(" | ")}`);
  }

  const recent = subs.filings.recent;
  const interesting = recent.form
    .map((form, i) => ({ form, date: recent.filingDate[i], desc: recent.primaryDocDescription[i] }))
    .filter((f) => ["10-K", "10-Q", "8-K", "DEF 14A"].includes(f.form))
    .slice(0, 10);
  if (interesting.length) {
    lines.push(`\nRECENT FILINGS:`);
    for (const f of interesting) lines.push(`- ${f.date}: ${f.form}${f.desc ? ` — ${f.desc}` : ""}`);
  }

  return lines.join("\n");
}
