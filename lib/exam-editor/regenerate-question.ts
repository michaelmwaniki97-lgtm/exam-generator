import "server-only";
import { aiClient } from "@/lib/ai/client";
import { AI_CONFIG } from "@/lib/ai/config";
import { regenerateSlotWithCompletion, type RegenerationParams } from "./regeneration-core";

export async function regenerateQuestion(params: RegenerationParams) {
  if (!AI_CONFIG.apiKey) throw new Error(`${AI_CONFIG.apiKeyEnv} is not set for AI_PROVIDER=${AI_CONFIG.provider}. Add it to .env.local to enable question regeneration.`);
  return regenerateSlotWithCompletion(params, async (messages) => {
    const completion = await aiClient.chat.completions.create({ model: AI_CONFIG.model, temperature: 0.3, max_tokens: 4096, messages });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("The AI returned an empty response. Please try again.");
    return raw;
  });
}
