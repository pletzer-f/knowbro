import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AnalysisResult } from "@/engine/src/types";

// List the user's saved dossiers (RLS scopes to the session user).
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dossiers")
    .select("id, company_name, config_fingerprint, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dossiers: data });
}

// Save a completed analysis (full structured output + reasoning trace + overrides).
export async function POST(req: NextRequest) {
  let body: { result?: AnalysisResult; overrides?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const r = body.result;
  if (!r?.final || !r?.input?.companyName) {
    return NextResponse.json({ error: "result (AnalysisResult) is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dossiers")
    .insert({
      company_name: r.input.companyName,
      input: r.input,
      draft: r.draft,
      critique: r.critique,
      dossier: r.final,
      steps: r.steps,
      config_fingerprint: r.configFingerprint,
      overrides: body.overrides ?? {},
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
