// Tiny per-day disk cache for source connectors. Protects rate-limited free
// tiers (FMP: 250 calls/day) — re-gathering the same company on the same day
// costs zero API calls. Lives in .cache/ (gitignored).

import fs from "node:fs";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), ".cache");

function keyToFile(namespace: string, key: string): string {
  const safe = key.toLowerCase().replace(/[^a-z0-9._-]+/g, "_").slice(0, 120);
  const day = new Date().toISOString().slice(0, 10);
  return path.join(CACHE_DIR, namespace, `${safe}.${day}.json`);
}

export function cacheGet<T>(namespace: string, key: string): T | null {
  try {
    const file = keyToFile(namespace, key);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function cacheSet(namespace: string, key: string, value: unknown): void {
  try {
    const file = keyToFile(namespace, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  } catch {
    // cache failures must never break a gather
  }
}

/** fetch JSON with day-caching. */
export async function cachedJson<T>(
  namespace: string,
  url: string,
  init?: RequestInit
): Promise<T> {
  const hit = cacheGet<T>(namespace, url);
  if (hit !== null) return hit;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${namespace} HTTP ${res.status} for ${url}`);
  const json = (await res.json()) as T;
  cacheSet(namespace, url, json);
  return json;
}
