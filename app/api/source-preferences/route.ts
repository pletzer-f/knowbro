import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DATA_SOURCES } from "@/lib/sources";

// GET — all sources with the user's enabled/disabled state (default: enabled).
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("source_preferences").select("source_id, enabled");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const stored = new Map((data ?? []).map((r) => [r.source_id, r.enabled]));
  return NextResponse.json({
    sources: DATA_SOURCES.map((s) => ({ ...s, enabled: stored.get(s.id) ?? true })),
  });
}

// PUT — set one source's enabled state.
export async function PUT(req: NextRequest) {
  let body: { source_id?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.source_id || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "source_id and enabled are required" }, { status: 400 });
  }
  if (!DATA_SOURCES.some((s) => s.id === body.source_id)) {
    return NextResponse.json({ error: `Unknown source_id '${body.source_id}'` }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("source_preferences")
    .upsert(
      { user_id: user!.id, source_id: body.source_id, enabled: body.enabled },
      { onConflict: "user_id,source_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
