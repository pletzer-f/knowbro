// Shared gather orchestration: registry connectors → market connectors →
// GLEIF → universal web research. Used by /api/gather (streaming, with the
// user's source prefs) and by the monitor (server-side, collecting the full
// pack). `enabled(id)` decides which sources run; `emit(text)` receives content.

import { gatherPublicData } from "./gather";
import { companiesHouseBlock, companiesHouseConfigured, searchCompanyNumber } from "./sources/companiesHouse";
import { secEdgarBlock } from "./sources/secEdgar";
import { fmpBlock, fmpConfigured } from "./sources/fmp";
import { gleifBlock } from "./sources/gleif";

export interface AssembleOpts {
  companyName: string;
  country?: string;
  companyNumber?: string;
  urls?: string[];
  includePeerComps?: boolean;
  isListed?: boolean;
  ticker?: string;
  todayIso: string;
}

export async function assembleSourcePack(
  opts: AssembleOpts,
  enabled: (id: string) => boolean,
  emit: (s: string) => void
): Promise<void> {
  const { companyName, todayIso } = opts;
  const isUk = /^(uk|united kingdom|gb|great britain|england|scotland|wales)$/i.test(opts.country?.trim() ?? "");

  // 1. Official UK register, deterministic and first.
  if (isUk && enabled("companies_house_uk")) {
    if (!companiesHouseConfigured()) {
      emit("[Note: UK Companies House connector is enabled but COMPANIES_HOUSE_API_KEY is not set — falling back to web research.]\n\n");
    } else {
      try {
        let number = opts.companyNumber?.trim();
        if (!number) {
          const hit = await searchCompanyNumber(companyName);
          if (hit) {
            number = hit.number;
            if (hit.title.toLowerCase() !== companyName.toLowerCase()) {
              emit(`[Companies House best match: ${hit.title} (${hit.number}) — verify this is the right company.]\n\n`);
            }
          }
        }
        if (number) emit((await companiesHouseBlock(number, todayIso)) + "\n\n");
        else emit(`[No Companies House match found for "${companyName}".]\n\n`);
      } catch (e) {
        emit(`[Companies House error: ${(e as Error).message}]\n\n`);
      }
    }
  }

  // 1b. Listed-company connectors (deterministic, day-cached).
  const ticker = opts.ticker?.trim();
  if (opts.isListed && ticker) {
    if (enabled("sec_edgar")) {
      try {
        const block = await secEdgarBlock(ticker, todayIso);
        if (block) emit(block + "\n\n");
      } catch (e) {
        emit(`[SEC EDGAR error: ${(e as Error).message}]\n\n`);
      }
    }
    if (enabled("fmp_market_data")) {
      if (!fmpConfigured()) emit("[Note: FMP market data enabled but FMP_API_KEY is not set — skipping.]\n\n");
      else {
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
        country: opts.country,
        urls: opts.urls,
        includePeerComps: opts.includePeerComps && enabled("peer_comps_web"),
        isListed: opts.isListed,
        todayIso,
      },
      emit
    );
  } else {
    emit("[Web research disabled in source preferences — only registry connectors were used.]\n");
  }
}
