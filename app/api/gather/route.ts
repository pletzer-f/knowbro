import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assembleSourcePack } from "@/engine/src/gatherAll";

export const maxDuration = 600;

// POST — assemble the public-data pack for a company, streaming as it builds.
// Honours the user's source preferences: a disabled source is never pulled.
export async function POST(req: NextRequest) {
  let body: {
    companyName?: string;
    country?: string;
    companyNumber?: string; // UK company number, optional
    urls?: string[];
    includePeerComps?: boolean;
    isListed?: boolean;
    ticker?: string; // for listed companies: enables SEC EDGAR + market data
    sourceOverrides?: Record<string, boolean>; // per-run toggles, win over saved prefs
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const companyName = body.companyName?.trim();
  if (!companyName) return NextResponse.json({ error: "companyName is required" }, { status: 400 });

  // Source preferences: per-run override (from the console chips) wins over the
  // user's saved default, which wins over the built-in default (enabled).
  const supabase = await createClient();
  const { data: prefRows } = await supabase.from("source_preferences").select("source_id, enabled");
  const prefs = new Map((prefRows ?? []).map((r) => [r.source_id, r.enabled]));
  const overrides = body.sourceOverrides ?? {};
  const enabled = (id: string) => overrides[id] ?? prefs.get(id) ?? true;

  const todayIso = new Date().toISOString().slice(0, 10);

  // NDJSON: {type:"text",text} for content, {type:"hb"} keepalives during the
  // silent web-search phase (so the streaming connection never idles out on
  // serverless), {type:"done"}. The client appends only text deltas.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      const emit = (s: string) => send({ type: "text", text: s });
      const heartbeat = setInterval(() => send({ type: "hb" }), 8000);
      const finish = () => {
        if (closed) return;
        clearInterval(heartbeat);
        closed = true;
        controller.close();
      };
      try {
        await assembleSourcePack(
          {
            companyName,
            country: body.country,
            companyNumber: body.companyNumber,
            urls: body.urls,
            includePeerComps: body.includePeerComps,
            isListed: body.isListed,
            ticker: body.ticker,
            todayIso,
          },
          enabled,
          emit
        );
        send({ type: "done" });
        finish();
      } catch (e) {
        emit(`\n\n[Error: ${(e as Error).message}]`);
        send({ type: "done" });
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
