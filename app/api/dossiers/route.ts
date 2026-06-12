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

// Save a completed analysis (full structured output + reasoning trace +
// overrides + any chat transcript that happened before saving).
export async function POST(req: NextRequest) {
  let body: {
    result?: AnalysisResult;
    overrides?: Record<string, string>;
    chat?: { role: "user" | "assistant"; content: string }[];
  };
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

  // Carry over the pre-save chat so the conversation continues on the saved page.
  const chat = (body.chat ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()
  );
  if (chat.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: chatError } = await supabase.from("chat_messages").insert(
      chat.map((m) => ({ user_id: user!.id, dossier_id: data.id, role: m.role, content: m.content }))
    );
    if (chatError) {
      // Dossier saved; transcript failed — report without failing the save.
      return NextResponse.json({ id: data.id, warning: `Chat transcript not saved: ${chatError.message}` });
    }
  }

  return NextResponse.json({ id: data.id });
}
