// The monitoring funnel for ONE company, shared by "Check now" (user session)
// and the cron (admin client). Cost funnel:
//   re-gather (modest) → triage (Haiku, cents) → re-analyze (Opus, only if
//   material) → delta + monitor_runs row + watchlist reschedule.
//
// Works with either a user-scoped client (RLS) or the admin client; every
// write is explicitly scoped by userId so the admin path stays safe.

import type { SupabaseClient } from "@supabase/supabase-js";
import { analyze } from "@/engine/src/engine";
import { assembleSourcePack } from "@/engine/src/gatherAll";
import { triagePacks, computeDelta, summarizeChange, type DossierDelta } from "@/engine/src/monitor";
import type { AnalysisInput, Dossier } from "@/engine/src/types";

export type MonitorPhase = "gather" | "triage" | "reanalyze" | "done";
export interface MonitorProgress {
  (phase: MonitorPhase, note?: string): void;
}

export interface MonitorOutcome {
  status: "no_change" | "changed" | "error";
  summary: string;
  dossierId: string | null;
  materiality: string;
}

const CADENCE_DAYS: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 91, manual: 0 };

function nextCheckIso(cadence: string): string | null {
  const days = CADENCE_DAYS[cadence] ?? 0;
  if (!days) return null;
  return new Date(Date.now() + days * 86400_000).toISOString();
}

interface GatherParams {
  country?: string;
  isListed?: boolean;
  ticker?: string;
  urls?: string[];
}

export async function runMonitorCheck(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  onProgress: MonitorProgress = () => {}
): Promise<MonitorOutcome> {
  // 1. Company + latest dossier (the baseline) + watchlist row.
  // Every read is scoped by user_id too — the cron's admin client bypasses RLS.
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .eq("user_id", userId)
    .single();
  if (!company) return { status: "error", summary: "Company not found", dossierId: null, materiality: "none" };

  const { data: latest } = await supabase
    .from("dossiers")
    .select("id, input, dossier")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) {
    return { status: "error", summary: "No baseline dossier — analyse the company first", dossierId: null, materiality: "none" };
  }
  const prevInput = latest.input as AnalysisInput;
  const prevDossier = latest.dossier as Dossier;
  const prevPack = prevInput.rawData ?? "";

  const { data: watch } = await supabase
    .from("watchlist")
    .select("id, cadence, gather_params")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  const gp = (watch?.gather_params as GatherParams) ?? {};

  // Source prefs (default enabled).
  const { data: prefRows } = await supabase.from("source_preferences").select("source_id, enabled").eq("user_id", userId);
  const prefs = new Map((prefRows ?? []).map((r) => [r.source_id, r.enabled]));
  const enabled = (id: string) => prefs.get(id) ?? true;

  // 2. Re-gather a fresh pack.
  onProgress("gather", "re-gathering public sources");
  let newPack = "";
  await assembleSourcePack(
    {
      companyName: company.name,
      country: gp.country,
      isListed: gp.isListed,
      ticker: gp.ticker,
      urls: gp.urls,
      includePeerComps: enabled("peer_comps_web"),
      todayIso: new Date().toISOString().slice(0, 10),
    },
    enabled,
    (s) => {
      newPack += s;
    }
  );

  // 3. Triage — cheap gate.
  onProgress("triage", "checking what changed");
  const triage = await triagePacks(prevPack, newPack);
  const material = triage.overall_materiality === "high" || triage.overall_materiality === "medium";

  let dossierId: string | null = null;
  let delta: DossierDelta | null = null;
  let status: "no_change" | "changed" = "no_change";

  // 4. Re-analyze only on material change.
  if (material) {
    onProgress("reanalyze", "material change — re-running the engine");
    const result = await analyze({
      companyName: company.name,
      rawData: newPack,
      userNotes: prevInput.userNotes,
    });
    delta = computeDelta(prevDossier, result.final);

    const { data: saved, error: saveErr } = await supabase
      .from("dossiers")
      .insert({
        user_id: userId,
        company_id: companyId,
        company_name: company.name,
        input: result.input,
        draft: result.draft,
        critique: result.critique,
        dossier: result.final,
        steps: result.steps,
        config_fingerprint: result.configFingerprint,
      })
      .select("id")
      .single();
    if (saveErr) throw new Error(saveErr.message);
    dossierId = saved.id;
    status = "changed";
  }

  const summary = material
    ? summarizeChange(triage, delta)
    : "Checked — nothing material changed";

  // 5. Record the run + reschedule.
  await supabase.from("monitor_runs").insert({
    user_id: userId,
    company_id: companyId,
    status,
    gathered_pack: newPack,
    triage,
    dossier_id: dossierId,
    delta: delta ?? {},
    summary,
  });

  if (watch) {
    await supabase
      .from("watchlist")
      .update({ last_checked_at: new Date().toISOString(), next_check_at: nextCheckIso(watch.cadence) })
      .eq("id", watch.id);
  }

  onProgress("done", summary);
  return { status, summary, dossierId, materiality: triage.overall_materiality };
}
