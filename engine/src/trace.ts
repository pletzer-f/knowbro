// Every dossier run writes a full reasoning trace to traces/<id>/ so quality
// can be inspected and config changes can be attributed.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AnalysisResult } from "./types";

// Local dev: ./traces. Serverless (read-only fs): fall back to the platform
// tmp dir — ephemeral, but the durable copy lives in the database whenever a
// dossier is saved. Trace writing must never fail an analysis.
const TRACES_DIR =
  process.env.TRACES_DIR ?? (process.env.VERCEL ? path.join(os.tmpdir(), "wba-traces") : path.join(process.cwd(), "traces"));

export function newTraceId(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}_${slug || "company"}`;
}

export function saveTrace(result: AnalysisResult): string {
  try {
    const dir = path.join(TRACES_DIR, result.traceId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(dir, "dossier.json"), JSON.stringify(result.final, null, 2));
    return dir;
  } catch (e) {
    console.warn(`Trace not written to disk (${(e as Error).message}) — DB copy on save remains the durable one.`);
    return "";
  }
}

export function loadTrace(traceId: string): AnalysisResult | null {
  const file = path.join(TRACES_DIR, traceId, "result.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
