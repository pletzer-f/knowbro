import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// Company page payload: the company, its time-stamped dossiers, its model.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const [companyRes, dossiersRes, modelRes, latestRes] = await Promise.all([
    supabase.from("companies").select("*").eq("id", id).single(),
    supabase
      .from("dossiers")
      .select("id, company_name, config_fingerprint, created_at")
      .eq("company_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("models").select("*").eq("company_id", id).maybeSingle(),
    // Full latest dossier — used to seed the financial model.
    supabase
      .from("dossiers")
      .select("dossier")
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (companyRes.error) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (dossiersRes.error) return NextResponse.json({ error: dossiersRes.error.message }, { status: 500 });
  return NextResponse.json({
    company: companyRes.data,
    dossiers: dossiersRes.data ?? [],
    model: modelRes.data ?? null,
    latest_dossier: latestRes.data?.dossier ?? null,
  });
}

// Deletes the company AND its dossiers/model/chats (DB cascades).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
