import { NextRequest, NextResponse } from "next/server";
import { analyze } from "@/engine/src/engine";

// Engine runs 2-3 long model calls (~5-10 min total). 800s is the ceiling on
// Vercel Pro fluid compute; measured full runs are ~500-600s.
export const maxDuration = 800;

// Streams NDJSON so the client can show live pass-by-pass progress:
//   {"type":"progress","phase":"draft","state":"start"}
//   ...
//   {"type":"result","result":{...}}   (terminal)
//   {"type":"error","error":"..."}     (terminal)
export async function POST(req: NextRequest) {
  let body: { companyName?: string; rawData?: string; userNotes?: string; quickScan?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const companyName = body.companyName?.trim();
  const rawData = body.rawData?.trim();
  if (!companyName || !rawData) {
    return NextResponse.json({ error: "companyName and rawData are required" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and add your key." },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await analyze(
          { companyName, rawData, userNotes: body.userNotes },
          {
            draftOnly: body.quickScan === true,
            onProgress: (phase, state, detail) => emit({ type: "progress", phase, state, detail }),
          }
        );
        emit({ type: "result", result });
      } catch (e) {
        emit({ type: "error", error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
