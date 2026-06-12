import { NextRequest, NextResponse } from "next/server";
import { analyze } from "@/engine/src/engine";

// Engine runs 2-3 long model calls; allow plenty of time when self-hosted.
export const maxDuration = 900;

export async function POST(req: NextRequest) {
  let body: { companyName?: string; rawData?: string; userNotes?: string };
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

  try {
    const result = await analyze({ companyName, rawData, userNotes: body.userNotes });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
