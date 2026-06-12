import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeMetrics } from "@/engine/src/metrics";
import type { Dossier } from "@/engine/src/types";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

// Upsert the company's living model (params and/or saved custom metrics).
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: { params?: unknown; custom_metrics?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.params === undefined && body.custom_metrics === undefined) {
    return NextResponse.json({ error: "params and/or custom_metrics required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase.from("models").select("id").eq("company_id", id).maybeSingle();
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (body.params !== undefined) patch.params = body.params;
    if (body.custom_metrics !== undefined) patch.custom_metrics = body.custom_metrics;
    const { error } = await supabase.from("models").update(patch).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("models").insert({
      user_id: user!.id,
      company_id: id,
      params: body.params ?? {},
      custom_metrics: body.custom_metrics ?? [],
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// POST — promptable metrics: stream the analyst's answer, then persist it
// to the model's custom_metrics list.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: { prompt?: string; modelParams?: unknown; modelOutputs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const prompt = body.prompt?.trim();
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const supabase = await createClient();

  // Context: the company's latest dossier (overrides/edits live in the row too).
  const { data: company } = await supabase.from("companies").select("name").eq("id", id).single();
  const { data: latest } = await supabase
    .from("dossiers")
    .select("dossier")
    .eq("company_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!company || !latest) {
    return NextResponse.json({ error: "Company has no dossier yet — run an analysis first" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const answer = await computeMetrics(
          {
            companyName: company.name,
            dossier: latest.dossier as Dossier,
            modelParams: body.modelParams ?? {},
            modelOutputs: body.modelOutputs ?? {},
          },
          prompt,
          (delta) => controller.enqueue(encoder.encode(delta))
        );

        // Append to the saved custom metrics (create the model row if needed).
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data: model } = await supabase
          .from("models")
          .select("id, custom_metrics")
          .eq("company_id", id)
          .maybeSingle();
        const entry = { prompt, response: answer, created_at: new Date().toISOString() };
        if (model) {
          const list = Array.isArray(model.custom_metrics) ? model.custom_metrics : [];
          await supabase.from("models").update({ custom_metrics: [...list, entry] }).eq("id", model.id);
        } else {
          await supabase.from("models").insert({
            user_id: user!.id,
            company_id: id,
            params: body.modelParams ?? {},
            custom_metrics: [entry],
          });
        }
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
