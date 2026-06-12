import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// My Companies: each with its dossier count, latest dossier, model presence.
export async function GET() {
  const supabase = await createClient();
  const [companiesRes, dossiersRes, modelsRes] = await Promise.all([
    supabase.from("companies").select("id, name, created_at").order("created_at", { ascending: false }),
    supabase.from("dossiers").select("id, company_id, created_at"),
    supabase.from("models").select("company_id"),
  ]);
  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 });
  if (dossiersRes.error) return NextResponse.json({ error: dossiersRes.error.message }, { status: 500 });
  if (modelsRes.error) return NextResponse.json({ error: modelsRes.error.message }, { status: 500 });

  const modelCompanies = new Set((modelsRes.data ?? []).map((m) => m.company_id));
  const companies = (companiesRes.data ?? []).map((c) => {
    const dossiers = (dossiersRes.data ?? []).filter((d) => d.company_id === c.id);
    const latest = dossiers.map((d) => d.created_at).sort().pop() ?? null;
    return {
      ...c,
      dossier_count: dossiers.length,
      latest_dossier_at: latest,
      has_model: modelCompanies.has(c.id),
    };
  });
  return NextResponse.json({ companies });
}
