import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gatherPublicData } from "@/engine/src/gather";
import { companiesHouseBlock, companiesHouseConfigured, searchCompanyNumber } from "@/engine/src/sources/companiesHouse";
import { secEdgarBlock } from "@/engine/src/sources/secEdgar";
import { fmpBlock, fmpConfigured } from "@/engine/src/sources/fmp";
import { gleifBlock } from "@/engine/src/sources/gleif";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const companyName = body.companyName?.trim();
  if (!companyName) return NextResponse.json({ error: "companyName is required" }, { status: 400 });

  // Source preferences (default enabled when no row exists).
  const supabase = await createClient();
  const { data: prefRows } = await supabase.from("source_preferences").select("source_id, enabled");
  const prefs = new Map((prefRows ?? []).map((r) => [r.source_id, r.enabled]));
  const enabled = (id: string) => prefs.get(id) ?? true;

  const todayIso = new Date().toISOString().slice(0, 10);
  const isUk = /^(uk|united kingdom|gb|great britain|england|scotland|wales)$/i.test(body.country?.trim() ?? "");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        // 1. Official registry connector (UK), deterministic and first.
        if (isUk && enabled("companies_house_uk")) {
          if (!companiesHouseConfigured()) {
            emit(
              "[Note: UK Companies House connector is enabled but COMPANIES_HOUSE_API_KEY is not set in .env.local — skipping the official register and falling back to web research.]\n\n"
            );
          } else {
            try {
              let number = body.companyNumber?.trim();
              if (!number) {
                const hit = await searchCompanyNumber(companyName);
                if (hit) {
                  number = hit.number;
                  if (hit.title.toLowerCase() !== companyName.toLowerCase()) {
                    emit(`[Companies House best match: ${hit.title} (${hit.number}) — verify this is the right company.]\n\n`);
                  }
                }
              }
              if (number) {
                emit((await companiesHouseBlock(number, todayIso)) + "\n\n");
              } else {
                emit(`[No Companies House match found for "${companyName}".]\n\n`);
              }
            } catch (e) {
              emit(`[Companies House error: ${(e as Error).message}]\n\n`);
            }
          }
        }

        // 1b. Listed-company connectors (deterministic, day-cached).
        const ticker = body.ticker?.trim();
        if (body.isListed && ticker) {
          if (enabled("sec_edgar")) {
            try {
              const block = await secEdgarBlock(ticker, todayIso);
              if (block) emit(block + "\n\n");
            } catch (e) {
              emit(`[SEC EDGAR error: ${(e as Error).message}]\n\n`);
            }
          }
          if (enabled("fmp_market_data")) {
            if (!fmpConfigured()) {
              emit("[Note: FMP market data is enabled but FMP_API_KEY is not set in .env.local — skipping.]\n\n");
            } else {
              try {
                const block = await fmpBlock(ticker, todayIso);
                if (block) emit(block + "\n\n");
              } catch (e) {
                emit(`[FMP error: ${(e as Error).message}]\n\n`);
              }
            }
          }
        }
        // 1c. Legal-entity / ownership graph (free, any country, LEI required).
        if (enabled("gleif")) {
          try {
            const block = await gleifBlock(companyName, todayIso);
            if (block) emit(block + "\n\n");
          } catch {
            // GLEIF misses are normal for small private companies — stay silent.
          }
        }

        // 2. Universal web research (all countries).
        if (enabled("web_research")) {
          await gatherPublicData(
            {
              companyName,
              country: body.country,
              urls: body.urls,
              includePeerComps: body.includePeerComps && enabled("peer_comps_web"),
              isListed: body.isListed,
              todayIso,
            },
            emit
          );
        } else {
          emit("[Web research is disabled in your source preferences — only registry connectors were used.]\n");
        }

        controller.close();
      } catch (e) {
        emit(`\n\n[Error: ${(e as Error).message}]`);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
