import "server-only";
import { aiClient } from "./client";
import { AI_CONFIG } from "./config";
import { generateExamWithCompletion, type ExamQuestion, type ExamSection, type GenerateExamCoreParams, type GeneratedExam, type MarkAllocation, type MarkingSchemeEntry, type TopicInput } from "./generation-core";

export type { ExamQuestion, ExamSection, GeneratedExam, MarkAllocation, MarkingSchemeEntry, TopicInput };
export type GenerateExamParams = GenerateExamCoreParams;
export class AiProviderTimeoutError extends Error { constructor() { super("The AI provider timed out. Please try again."); this.name = "AiProviderTimeoutError"; } }
export class GenerationDeadlineError extends Error { constructor() { super("Exam generation reached its execution limit. Please try a smaller exam."); this.name = "GenerationDeadlineError"; } }
export async function generateExam(params: GenerateExamParams): Promise<GeneratedExam> {
  if (!AI_CONFIG.apiKey) throw new Error("NVIDIA_API_KEY is not set. Add it to .env.local to enable exam generation.");
  const deadline = Date.now() + AI_CONFIG.generationBudgetMs;
  return generateExamWithCompletion(params, async (messages) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new GenerationDeadlineError();
    const signal = AbortSignal.timeout(Math.min(AI_CONFIG.providerTimeoutMs, remaining));
    let completion;
    try { completion = await aiClient.chat.completions.create({ model: AI_CONFIG.model, temperature: 0.3, max_tokens: 8192, messages }, { signal }); }
    catch (error) { if (signal.aborted) throw remaining <= AI_CONFIG.providerTimeoutMs ? new GenerationDeadlineError() : new AiProviderTimeoutError(); throw error; }
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("The AI returned an empty response. Please try again.");
    return raw;
  });
}
