// The company-scoped chatbot. Same judgment standards and legitimacy boundary
// as the engine (see engine/config/prompts/chat.md). The chat context is the
// original source data + the final dossier + the red-team critique — the
// dossier's inference paths carry the reasoning trace the chat refers to.

import type { AnalysisInput, Critique, Dossier } from "./types";
import { loadEngineConfig } from "./config";
import { getProvider, type ChatTurn } from "./llm";

export type { ChatTurn };

export interface ChatContext {
  input: AnalysisInput;
  dossier: Dossier;
  critique: Critique;
}

function buildContextBlock(ctx: ChatContext): string {
  return [
    `# Company\n\n${ctx.input.companyName}`,
    `# Original source data (the only company-specific source material)\n\n${ctx.input.rawData}`,
    ctx.input.userNotes?.trim() ? `# User's private notes\n\n${ctx.input.userNotes}` : "",
    `# Final dossier (JSON — includes every estimate's inference path)\n\n${JSON.stringify(ctx.dossier, null, 2)}`,
    `# Red-team critique of the dossier (JSON)\n\n${JSON.stringify(ctx.critique, null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export async function chatRespond(
  ctx: ChatContext,
  history: ChatTurn[],
  onDelta: (text: string) => void
): Promise<string> {
  const config = loadEngineConfig();
  const provider = getProvider(config.models.provider);

  // Context goes into the system prompt (after the standards) so it is cached
  // across turns; the conversation itself stays in messages.
  const system = `${config.chatSystemPrompt}\n\n---\n\n${buildContextBlock(ctx)}`;

  const result = await provider.streamText({
    system,
    messages: history,
    pass: config.models.passes.chat,
    onDelta,
  });

  return result.text;
}
