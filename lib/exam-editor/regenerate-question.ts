import { completeAnthropic } from "../ai/anthropic";
import "server-only";
import { aiClient } from "@/lib/ai/client";
import { AI_CONFIG } from "@/lib/ai/config";
import { regenerateSlotWithCompletion, type RegenerationParams } from "./regeneration-core";
import { AI_ABUSE_LIMITS, regenerationRequestTimeoutMs } from "../ai/abuse-controls-core";

export class RegenerationDeadlineError extends Error {
  constructor() { super("Question regeneration reached its execution limit. Please try again."); this.name = "RegenerationDeadlineError"; }
}

export async function regenerateQuestion(params: RegenerationParams) {
  if (!AI_CONFIG.apiKey) throw new Error(`${AI_CONFIG.apiKeyEnv} is not set for AI_PROVIDER=${AI_CONFIG.provider}. Add it to .env.local to enable question regeneration.`);
  const deadline = Date.now() + AI_ABUSE_LIMITS.regenerationBudgetMs;
  return regenerateSlotWithCompletion(params, async (messages) => {
    let timeoutMs: number;
    try { timeoutMs = regenerationRequestTimeoutMs(Date.now(), deadline); }
    catch { throw new RegenerationDeadlineError(); }
    const signal = AbortSignal.timeout(timeoutMs);
    let completion;
    try {
      if (AI_CONFIG.provider === "anthropic") return await completeAnthropic({ apiKey: AI_CONFIG.apiKey!, model: AI_CONFIG.model, messages, signal });
      completion = await aiClient.chat.completions.create({ model: AI_CONFIG.model, temperature: 0.3, max_tokens: 4096, messages }, { signal });
    } catch (error) {
      if (signal.aborted) throw new RegenerationDeadlineError();
      throw error;
    }
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("The AI returned an empty response. Please try again.");
    return raw;
  });
}
