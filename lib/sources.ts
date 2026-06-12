// The data sources the gather layer can pull from. Preferences are stored per
// user and enforced in /api/gather: a source you switch off is never pulled.

export interface DataSource {
  id: string;
  label: string;
  description: string;
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: "web_research",
    label: "Web research (all countries)",
    description:
      "The engine searches and reads public web pages itself: public registry portals (firmenabc.at, northdata.de, SEC EDGAR, ...), company website, press, job ads. Public pages only — never logins or paywalls.",
  },
  {
    id: "companies_house_uk",
    label: "UK Companies House (official API)",
    description:
      "Free official register: profile, officers, PSCs, charges, filing history. Needs COMPANIES_HOUSE_API_KEY in .env.local.",
  },
  {
    id: "peer_comps_web",
    label: "Listed-peer multiples from public web",
    description:
      "When fetching data, also collect EV/EBITDA multiples of listed sector peers from public financial pages — feeds the model's peer-comp table as a supporting input.",
  },
  {
    id: "sec_edgar",
    label: "SEC EDGAR (US listed, official API)",
    description:
      "Audited US-GAAP annual figures and filing history for US-registered companies, straight from the SEC. Free, no key.",
  },
  {
    id: "fmp_market_data",
    label: "Market snapshot via FMP (listed companies)",
    description:
      "Share price, market cap, sector, employees for any listed ticker (free tier; deeper metrics are premium-gated, so multiples come from web research). 1 day-cached call per company. Needs FMP_API_KEY.",
  },
  {
    id: "gleif",
    label: "GLEIF legal-entity register",
    description:
      "Global LEI lookup: legal identity and reported parent/ultimate-parent relationships. Free, no key. Mostly hits larger entities.",
  },
  {
    id: "sp_global_comps",
    label: "S&P Global comparables (deferred)",
    description: "Professional comps feed — integrates when credentials are available. Until then, peer multiples come from the web, FMP, or by hand.",
  },
];
