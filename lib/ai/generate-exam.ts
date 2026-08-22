import "server-only";
import { aiClient } from "./client";
import { AI_CONFIG } from "./config";
import { generateExamWithCompletion, type ExamQuestion, type ExamSection, type GenerateExamCoreParams, type GeneratedExam, type MarkAllocation, type MarkingSchemeEntry, type TopicInput } from "./generation-core";

export type { ExamQuestion, ExamSection, GeneratedExam, MarkAllocation, MarkingSchemeEntry, TopicInput };
export type GenerateExamParams = GenerateExamCoreParams;
export async function generateExam(params: GenerateExamParams): Promise<GeneratedExam> {
  if (!AI_CONFIG.apiKey) throw new Error("NVIDIA_API_KEY is not set. Add it to .env.local to enable exam generation.");
  return generateExamWithCompletion(params, async (messages) => {
    const completion = await aiClient.chat.completions.create({ model: AI_CONFIG.model, temperature: 0.3, max_tokens: 8192, messages });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("The AI returned an empty response. Please try again.");
    return raw;
  });
}
