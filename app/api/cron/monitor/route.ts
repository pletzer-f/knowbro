import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { runMonitorCheck } from "@/lib/monitorRunner";

// Scheduled monitoring. Vercel Cron hits this; it processes watchlist rows
// that are due, capped per invocation so a long re-analysis can't blow the
// function limit (the rest roll to the next tick). Protected by CRON_SECRET.
export const maxDuration = 800;

// Re-analyses are ~8 min each; keep well inside maxDuration.
const MAX_REANALYSES_PER_TICK = 2;
const MAX_COMPANIES_PER_TICK = 8;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>; also allow ?key=.
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("key") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminConfigured()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set — cron disabled" }, { status: 503 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: due, error } = await admin
    .from("watchlist")
    .select("user_id, company_id, cadence, next_check_at")
    .eq("enabled", true)
    .neq("cadence", "manual")
    .lte("next_check_at", nowIso)
    .order("next_check_at", { ascending: true })
    .limit(MAX_COMPANIES_PER_TICK);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const processed: { company_id: string; status: string; summary: string }[] = [];
  let reanalyses = 0;
  for (const w of due ?? []) {
    if (reanalyses >= MAX_REANALYSES_PER_TICK) break; // carry the rest to next tick
    try {
      const outcome = await runMonitorCheck(admin, w.user_id, w.company_id);
      processed.push({ company_id: w.company_id, status: outcome.status, summary: outcome.summary });
      if (outcome.status === "changed") reanalyses++;
    } catch (e) {
      processed.push({ company_id: w.company_id, status: "error", summary: (e as Error).message });
    }
  }

  return NextResponse.json({ checked: processed.length, reanalyses, processed });
}
