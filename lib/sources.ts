// The data sources planned for Phase 4. Preferences are stored per user now;
// the pull layer will honour them when live sources arrive. Declined sources
// are excluded from future pulls for that user.

export interface DataSource {
  id: string;
  label: string;
  description: string;
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: "companies_house_uk",
    label: "UK Companies House",
    description: "Free official API: filings, accounts (incl. AI extraction of scanned PDFs), officers, charges.",
  },
  {
    id: "firmenbuch_at",
    label: "Firmenbuch (Austria)",
    description: "Austrian company register via lawful access: ownership, management, abridged accounts.",
  },
  {
    id: "bundesanzeiger_de",
    label: "Bundesanzeiger (Germany)",
    description: "German filings and disclosures via free/lawful wrappers.",
  },
  {
    id: "sp_global_comps",
    label: "S&P Global listed comparables",
    description: "Listed-comparable benchmarks used as a supporting triangulation input — never the spine.",
  },
];
