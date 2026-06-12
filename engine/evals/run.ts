// Eval harness CLI.
//
//   npm run eval                      run the engine on all test companies
//   npm run eval -- alpenstahl        run one company
//   npm run eval -- --draft-only      skip critique+revise (cheap iteration)
//   npm run eval:checks               re-run structural checks on the latest run (no LLM calls)
//   npm run eval:list                 list companies and past runs
//
// Each run is saved under engine/evals/runs/<timestamp>_<configFingerprint>/ so
// outputs can be compared across config versions as the chains are refined.

import fs from "node:fs";
import path from "node:path";
import { analyze } from "../src/engine";
import { loadEngineConfig } from "../src/config";
import { runChecks, type CheckResult } from "./checks";
import type { AnalysisResult } from "../src/types";

const COMPANIES_DIR = path.join(process.cwd(), "engine", "evals", "companies");
const RUNS_DIR = path.join(process.cwd(), "engine", "evals", "runs");

interface TestCompany {
  id: string;
  companyName: string;
  focus: string;
  rawData: string;
  userNotes: string;
  humanReviewHints: string[];
}

function loadCompanies(): TestCompany[] {
  return fs
    .readdirSync(COMPANIES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(COMPANIES_DIR, f), "utf-8")));
}

function listRuns(): string[] {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs.readdirSync(RUNS_DIR).filter((d) => fs.statSync(path.join(RUNS_DIR, d)).isDirectory()).sort();
}

function printChecks(companyId: string, checks: CheckResult[]) {
  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n  Checks for ${companyId}: ${passed}/${checks.length} passed`);
  for (const c of checks) {
    console.log(`    ${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  (${c.detail})` : ""}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list")) {
    console.log("Test companies:");
    for (const c of loadCompanies()) console.log(`  ${c.id} — ${c.companyName}\n      focus: ${c.focus}`);
    console.log("\nPast runs:");
    for (const r of listRuns()) console.log(`  ${r}`);
    return;
  }

  if (args.includes("--checks-only")) {
    const runs = listRuns();
    if (runs.length === 0) {
      console.log("No runs yet. Run `npm run eval` first.");
      return;
    }
    const latest = runs[runs.length - 1];
    const runDir = path.join(RUNS_DIR, latest);
    console.log(`Re-running structural checks on ${latest}`);
    for (const f of fs.readdirSync(runDir).filter((f) => f.endsWith(".result.json"))) {
      const result: AnalysisResult = JSON.parse(fs.readFileSync(path.join(runDir, f), "utf-8"));
      printChecks(f.replace(".result.json", ""), runChecks(result));
    }
    return;
  }

  const draftOnly = args.includes("--draft-only");
  const companyFilter = args.filter((a) => !a.startsWith("--"));
  const companies = loadCompanies().filter((c) => companyFilter.length === 0 || companyFilter.includes(c.id));
  if (companies.length === 0) {
    console.error(`No matching companies. Available: ${loadCompanies().map((c) => c.id).join(", ")}`);
    process.exit(1);
  }

  const config = loadEngineConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const runDir = path.join(RUNS_DIR, `${stamp}_${config.fingerprint}`);
  fs.mkdirSync(runDir, { recursive: true });
  console.log(`Run directory: ${runDir}`);
  console.log(`Config fingerprint: ${config.fingerprint}${draftOnly ? "  (draft-only mode)" : ""}`);

  const summary: { id: string; passed: number; total: number; durationS: number; tokens: number }[] = [];

  for (const company of companies) {
    console.log(`\n=== ${company.companyName} (${company.id}) ===`);
    const started = Date.now();
    try {
      const result = await analyze(
        { companyName: company.companyName, rawData: company.rawData, userNotes: company.userNotes },
        {
          draftOnly,
          onProgress: (phase, state) => state === "start" && console.log(`  ${phase} pass...`),
        }
      );
      fs.writeFileSync(path.join(runDir, `${company.id}.result.json`), JSON.stringify(result, null, 2));
      fs.writeFileSync(path.join(runDir, `${company.id}.dossier.json`), JSON.stringify(result.final, null, 2));

      const checks = runChecks(result);
      printChecks(company.id, checks);

      const tokens = result.steps.reduce((t, s) => t + s.usage.inputTokens + s.usage.outputTokens, 0);
      summary.push({
        id: company.id,
        passed: checks.filter((c) => c.pass).length,
        total: checks.length,
        durationS: Math.round((Date.now() - started) / 1000),
        tokens,
      });

      console.log(`\n  Human review hints for ${company.id} (judge the dossier against these):`);
      for (const h of company.humanReviewHints) console.log(`   - ${h}`);
    } catch (e) {
      console.error(`  FAILED: ${(e as Error).message}`);
      summary.push({ id: company.id, passed: 0, total: 0, durationS: Math.round((Date.now() - started) / 1000), tokens: 0 });
    }
  }

  console.log("\n=== Summary ===");
  for (const s of summary) {
    console.log(`  ${s.id}: ${s.passed}/${s.total} checks, ${s.durationS}s, ~${s.tokens.toLocaleString()} tokens`);
  }
  console.log(`\nOutputs saved to ${runDir}`);
  console.log("Compare against a previous run with your diff tool of choice — dossier JSONs are pretty-printed for diffing.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
