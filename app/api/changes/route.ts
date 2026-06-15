import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The changes feed — recent material changes across the user's watched
// companies (status = 'changed'), newest first.
export async function GET() {
  const supabase = await createClient();
  const [runsRes, companiesRes] = await Promise.all([
    supabase
      .from("monitor_runs")
      .select("id, company_id, ran_at, status, summary, dossier_id, delta")
      .eq("status", "changed")
      .order("ran_at", { ascending: false })
      .limit(50),
    supabase.from("companies").select("id, name"),
  ]);
  if (runsRes.error) return NextResponse.json({ error: runsRes.error.message }, { status: 500 });
  const names = new Map((companiesRes.data ?? []).map((c) => [c.id, c.name]));
  const changes = (runsRes.data ?? []).map((r) => ({ ...r, company_name: names.get(r.company_id) ?? "(unknown)" }));
  return NextResponse.json({ changes });
}
