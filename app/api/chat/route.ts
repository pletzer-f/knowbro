import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatRespond, type ChatContext, type ChatTurn } from "@/engine/src/chat";
import type { AnalysisResult } from "@/engine/src/types";

export const maxDuration = 300;

// GET /api/chat?dossierId= — persisted conversation for a saved dossier.
export async function GET(req: NextRequest) {
  const dossierId = req.nextUrl.searchParams.get("dossierId");
  if (!dossierId) return NextResponse.json({ error: "dossierId required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("dossier_id", dossierId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data });
}

// POST — answer the latest user message, streaming plain text back.
// Two modes:
//   saved:  { dossierId, messages }            — context loaded from the DB row, exchange persisted
//   fresh:  { result (AnalysisResult), messages } — context from the in-memory result, nothing persisted
export async function POST(req: NextRequest) {
  let body: { dossierId?: string; result?: AnalysisResult; messages?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages;
  if (!messages?.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "messages must end with a user message" }, { status: 400 });
  }

  let ctx: ChatContext;
  let persist: ((answer: string) => Promise<void>) | null = null;

  if (body.dossierId) {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("dossiers")
      .select("input, dossier, critique")
      .eq("id", body.dossierId)
      .single();
    if (error || !row) return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    ctx = { input: row.input, dossier: row.dossier, critique: row.critique };

    const dossierId = body.dossierId;
    const userMessage = messages[messages.length - 1].content;
    persist = async (answer: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("chat_messages").insert([
        { user_id: user!.id, dossier_id: dossierId, role: "user", content: userMessage },
        { user_id: user!.id, dossier_id: dossierId, role: "assistant", content: answer },
      ]);
    };
  } else if (body.result?.final) {
    ctx = { input: body.result.input, dossier: body.result.final, critique: body.result.critique };
  } else {
    return NextResponse.json({ error: "Either dossierId or result is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const answer = await chatRespond(ctx, messages, (delta) => {
          controller.enqueue(encoder.encode(delta));
        });
        if (persist) await persist(answer);
        controller.close();
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[Error: ${(e as Error).message}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
