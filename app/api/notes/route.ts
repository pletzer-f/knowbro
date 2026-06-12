import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/notes?company=<name> — the user's private note for that company.
export async function GET(req: NextRequest) {
  const company = req.nextUrl.searchParams.get("company")?.trim();
  if (!company) return NextResponse.json({ error: "company query param required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("content, updated_at")
    .eq("company_name", company)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ content: data?.content ?? "", updated_at: data?.updated_at ?? null });
}

// PUT — upsert the note (one per user per company).
export async function PUT(req: NextRequest) {
  let body: { company_name?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const company = body.company_name?.trim();
  if (!company || typeof body.content !== "string") {
    return NextResponse.json({ error: "company_name and content are required" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("notes")
    .upsert(
      { user_id: user!.id, company_name: company, content: body.content },
      { onConflict: "user_id,company_name" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
