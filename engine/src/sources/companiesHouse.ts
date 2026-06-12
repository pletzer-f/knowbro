// UK Companies House — free official API. Deterministic and authoritative:
// runs before the web-research pass for UK companies and its output is
// labelled filed/registry data in the source pack.
// Key: register at developer.company-information.service.gov.uk and set
// COMPANIES_HOUSE_API_KEY in .env.local. Auth is HTTP Basic, key as username.

const BASE = "https://api.company-information.service.gov.uk";

interface ChItem {
  [key: string]: unknown;
}

async function ch(path: string): Promise<ChItem | null> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw new Error("COMPANIES_HOUSE_API_KEY is not set in .env.local");
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Companies House API ${res.status} for ${path}`);
  return (await res.json()) as ChItem;
}

export function companiesHouseConfigured(): boolean {
  return !!process.env.COMPANIES_HOUSE_API_KEY;
}

/** Resolve a company number from a name (best match). */
export async function searchCompanyNumber(name: string): Promise<{ number: string; title: string } | null> {
  const data = await ch(`/search/companies?q=${encodeURIComponent(name)}&items_per_page=5`);
  const items = (data?.items as ChItem[] | undefined) ?? [];
  const first = items[0];
  if (!first) return null;
  return { number: String(first.company_number), title: String(first.title) };
}

const j = (v: unknown) => (v === undefined || v === null ? "n/a" : String(v));

/** Fetch the full public record for one company number, formatted as a
 *  labelled source-pack block. */
export async function companiesHouseBlock(companyNumber: string, todayIso: string): Promise<string> {
  const [profile, officers, pscs, charges, filings] = await Promise.all([
    ch(`/company/${companyNumber}`),
    ch(`/company/${companyNumber}/officers?items_per_page=35`),
    ch(`/company/${companyNumber}/persons-with-significant-control?items_per_page=25`),
    ch(`/company/${companyNumber}/charges?items_per_page=25`),
    ch(`/company/${companyNumber}/filing-history?items_per_page=30`),
  ]);
  if (!profile) throw new Error(`Company ${companyNumber} not found at Companies House`);

  const lines: string[] = [];
  lines.push(`COMPANIES HOUSE — OFFICIAL UK REGISTER (api.company-information.service.gov.uk, retrieved ${todayIso}):`);
  const accounts = profile.accounts as ChItem | undefined;
  const lastAccounts = accounts?.last_accounts as ChItem | undefined;
  lines.push(
    `${j(profile.company_name)}, company no. ${j(profile.company_number)}, status: ${j(profile.company_status)}, ` +
      `incorporated ${j(profile.date_of_creation)}, type: ${j(profile.type)}. ` +
      `Registered office: ${JSON.stringify(profile.registered_office_address ?? {})}. ` +
      `SIC codes: ${(profile.sic_codes as string[] | undefined)?.join(", ") ?? "n/a"}. ` +
      `Last accounts: made up to ${j(lastAccounts?.made_up_to)} (type: ${j(lastAccounts?.type)}); ` +
      `next accounts due ${j((accounts?.next_accounts as ChItem | undefined)?.due_on)}${profile.has_been_liquidated ? "; HAS BEEN LIQUIDATED" : ""}${profile.has_charges ? "; has registered charges" : ""}.`
  );

  const officerItems = (officers?.items as ChItem[] | undefined) ?? [];
  if (officerItems.length) {
    lines.push(`\nOFFICERS (${j(officers?.active_count)} active, ${j(officers?.resigned_count)} resigned):`);
    for (const o of officerItems.slice(0, 25)) {
      const dob = o.date_of_birth as ChItem | undefined;
      lines.push(
        `- ${j(o.name)}, ${j(o.officer_role)}, appointed ${j(o.appointed_on)}${o.resigned_on ? `, RESIGNED ${j(o.resigned_on)}` : ""}` +
          (dob ? `, born ${j(dob.month)}/${j(dob.year)}` : "") +
          (o.occupation ? `, occupation: ${j(o.occupation)}` : "")
      );
    }
  }

  const pscItems = (pscs?.items as ChItem[] | undefined) ?? [];
  if (pscItems.length) {
    lines.push(`\nPERSONS WITH SIGNIFICANT CONTROL:`);
    for (const p of pscItems) {
      lines.push(
        `- ${j(p.name)}${p.kind ? ` (${j(p.kind)})` : ""}, natures of control: ${(p.natures_of_control as string[] | undefined)?.join("; ") ?? "n/a"}${p.ceased_on ? `, CEASED ${j(p.ceased_on)}` : ""}`
      );
    }
  }

  const chargeItems = (charges?.items as ChItem[] | undefined) ?? [];
  lines.push(
    `\nCHARGES REGISTER (${j(charges?.total_count ?? 0)} total, ${j(charges?.satisfied_count ?? 0)} satisfied):`
  );
  if (chargeItems.length === 0) lines.push("- none registered");
  for (const c of chargeItems.slice(0, 20)) {
    const persons = (c.persons_entitled as ChItem[] | undefined)?.map((p) => j(p.name)).join(", ") ?? "n/a";
    const particulars = c.particulars as ChItem | undefined;
    lines.push(
      `- Created ${j(c.created_on)}, status: ${j(c.status)}${c.satisfied_on ? ` (satisfied ${j(c.satisfied_on)})` : ""}, in favour of: ${persons}. ${particulars?.description ? `Particulars: ${j(particulars.description)}` : ""}`
    );
  }

  const filingItems = (filings?.items as ChItem[] | undefined) ?? [];
  if (filingItems.length) {
    lines.push(`\nFILING HISTORY (last ${Math.min(filingItems.length, 20)} — filing punctuality is a health signal):`);
    for (const f of filingItems.slice(0, 20)) {
      lines.push(`- ${j(f.date)}: ${j(f.category)} — ${j(f.description)}`);
    }
  }

  return lines.join("\n");
}
