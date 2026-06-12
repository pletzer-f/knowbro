// GLEIF — the global LEI register. Free, official, no key. Gives legal-entity
// identity and parent relationships (who owns whom) for entities with an LEI.

import { cachedJson } from "./cache";

const BASE = "https://api.gleif.org/api/v1";

interface LeiRecord {
  id: string;
  attributes: {
    lei: string;
    entity: {
      legalName: { name: string };
      legalAddress: { addressLines?: string[]; city?: string; country?: string };
      status: string;
      category?: string;
    };
  };
}

interface LeiList {
  data: LeiRecord[];
}

interface ParentResponse {
  data?: LeiRecord;
}

async function directParent(lei: string): Promise<string | null> {
  try {
    const res = await cachedJson<ParentResponse>("gleif", `${BASE}/lei-records/${lei}/direct-parent`);
    return res.data ? res.data.attributes.entity.legalName.name : null;
  } catch {
    return null; // no parent reported (exception or none) — normal
  }
}

async function ultimateParent(lei: string): Promise<string | null> {
  try {
    const res = await cachedJson<ParentResponse>("gleif", `${BASE}/lei-records/${lei}/ultimate-parent`);
    return res.data ? res.data.attributes.entity.legalName.name : null;
  } catch {
    return null;
  }
}

/** Legal-entity block by company name; null when no LEI exists (common for
 *  smaller private companies — not an error). */
export async function gleifBlock(companyName: string, todayIso: string): Promise<string | null> {
  const list = await cachedJson<LeiList>(
    "gleif",
    `${BASE}/lei-records?filter[entity.legalName]=${encodeURIComponent(companyName)}&page[size]=3`
  );
  const rec = list.data?.[0];
  if (!rec) return null;

  const e = rec.attributes.entity;
  const [direct, ultimate] = await Promise.all([
    directParent(rec.attributes.lei),
    ultimateParent(rec.attributes.lei),
  ]);

  const lines: string[] = [];
  lines.push(`GLEIF — GLOBAL LEI REGISTER (api.gleif.org, retrieved ${todayIso}):`);
  lines.push(
    `${e.legalName.name}, LEI ${rec.attributes.lei}, status ${e.status}. ` +
      `Legal address: ${[...(e.legalAddress.addressLines ?? []), e.legalAddress.city, e.legalAddress.country]
        .filter(Boolean)
        .join(", ")}.`
  );
  if (direct) lines.push(`Direct parent (per LEI relationship reporting): ${direct}`);
  if (ultimate && ultimate !== direct) lines.push(`Ultimate parent: ${ultimate}`);
  if (!direct && !ultimate)
    lines.push(`No parent relationship reported in the LEI system (does not prove independence).`);
  if (list.data.length > 1) {
    lines.push(
      `Note: ${list.data.length} LEI matches for this name — this block uses the first; verify it is the right entity.`
    );
  }
  return lines.join("\n");
}
