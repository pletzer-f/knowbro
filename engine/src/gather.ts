// The gather pass: collects the public record on a company from the open web
// (server-side search + fetch through the model provider — no separate search
// API). Output is a labelled source pack the analysis engine consumes. The
// legitimacy boundary lives in engine/config/prompts/gather.md.

import { loadEngineConfig } from "./config";
import { getProvider } from "./llm";

export interface GatherRequest {
  companyName: string;
  country?: string; // free text hint, e.g. "Austria"
  /** Optional URLs the user wants included (their own source picks). */
  urls?: string[];
  /** Also collect listed-peer multiples for the financial model. */
  includePeerComps?: boolean;
  /** The company is publicly listed — shifts gathering toward IR/filings/market data. */
  isListed?: boolean;
  /** Injected so the pack carries real retrieval dates (prompt stays cacheable). */
  todayIso: string;
}

export async function gatherPublicData(req: GatherRequest, onDelta: (text: string) => void): Promise<string> {
  const config = loadEngineConfig();
  const provider = getProvider(config.models.provider);

  const userParts = [
    `Collect the public record for this company. Today's date: ${req.todayIso}.`,
    `Company: ${req.companyName}`,
    req.country ? `Country / home market: ${req.country}` : "",
    req.urls?.length
      ? `The user specifically wants these pages included (fetch each):\n${req.urls.map((u) => `- ${u}`).join("\n")}`
      : "",
    req.includePeerComps
      ? "Also collect a LISTED PEER MULTIPLES section: 3-6 listed companies in the same sector with current EV/EBITDA (or closest available multiple), each with source and date."
      : "",
    req.isListed
      ? "This company is PUBLICLY LISTED — follow the listed-company priorities (IR figures, market cap/multiples, shareholder structure, guidance)."
      : "",
  ].filter(Boolean);

  const result = await provider.researchText({
    system: config.gatherSystemPrompt,
    messages: [{ role: "user", content: userParts.join("\n\n") }],
    pass: config.models.passes.gather,
    onDelta,
  });

  return result.text;
}
