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
    id: "sp_global_comps",
    label: "S&P Global comparables (deferred)",
    description: "Professional comps feed — integrates when credentials are available. Until then, peer multiples come from the web or by hand.",
  },
];
