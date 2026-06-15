import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — the user's watchlist with each company's name + latest run summary.
export async function GET() {
  const supabase = await createClient();
  const [watchRes, companiesRes, runsRes] = await Promise.all([
    supabase.from("watchlist").select("*").order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name"),
    supabase.from("monitor_runs").select("company_id, ran_at, status, summary").order("ran_at", { ascending: false }),
  ]);
  if (watchRes.error) return NextResponse.json({ error: watchRes.error.message }, { status: 500 });
  const names = new Map((companiesRes.data ?? []).map((c) => [c.id, c.name]));
  const latestRun = new Map<string, { ran_at: string; status: string; summary: string }>();
  for (const r of runsRes.data ?? []) if (!latestRun.has(r.company_id)) latestRun.set(r.company_id, r);

  const items = (watchRes.data ?? []).map((w) => ({
    ...w,
    company_name: names.get(w.company_id) ?? "(unknown)",
    last_run: latestRun.get(w.company_id) ?? null,
  }));
  return NextResponse.json({ watchlist: items });
}

// PUT — add or update a watch (cadence, enabled, gather params).
export async function PUT(req: NextRequest) {
  let body: {
    company_id?: string;
    cadence?: string;
    enabled?: boolean;
    gather_params?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.company_id) return NextResponse.json({ error: "company_id required" }, { status: 400 });
  const cadence = body.cadence ?? "monthly";
  if (!["manual", "weekly", "monthly", "quarterly"].includes(cadence)) {
    return NextResponse.json({ error: "invalid cadence" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const days: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 91, manual: 0 };
  const next = days[cadence] ? new Date(Date.now() + days[cadence] * 86400_000).toISOString() : null;

  const { error } = await supabase.from("watchlist").upsert(
    {
      user_id: user!.id,
      company_id: body.company_id,
      cadence,
      enabled: body.enabled ?? true,
      next_check_at: next,
      ...(body.gather_params ? { gather_params: body.gather_params } : {}),
    },
    { onConflict: "user_id,company_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/watchlist?company_id=... — stop watching.
export async function DELETE(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("company_id");
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("watchlist").delete().eq("company_id", companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
