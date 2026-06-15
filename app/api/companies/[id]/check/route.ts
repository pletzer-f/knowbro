import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runMonitorCheck } from "@/lib/monitorRunner";

// "Check now" — run the monitoring funnel for one company, streaming
// pass-by-pass progress (gather → triage → maybe re-analyze) as NDJSON.
export const maxDuration = 800;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      const hb = setInterval(() => send({ type: "hb" }), 8000);
      const finish = () => {
        if (closed) return;
        clearInterval(hb);
        closed = true;
        controller.close();
      };
      try {
        const outcome = await runMonitorCheck(supabase, user.id, id, (phase, note) =>
          send({ type: "progress", phase, note })
        );
        send({ type: "result", outcome });
        finish();
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
