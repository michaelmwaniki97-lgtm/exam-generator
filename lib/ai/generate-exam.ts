import "server-only";
import { aiClient } from "./client";
import { AI_CONFIG } from "./config";
import { describeViolations, generateMarkingContentWithCompletion, generateQuestionContentWithCompletion, type ExamQuestion, type ExamSection, type GenerateExamCoreParams, type GeneratedExam, type MarkAllocation, type MarkingSchemeEntry, type TopicInput, type StructuredResponseFormat } from "./generation-core";

export type { ExamQuestion, ExamSection, GeneratedExam, MarkAllocation, MarkingSchemeEntry, TopicInput };
export type GenerateExamParams = GenerateExamCoreParams;
export class AiProviderTimeoutError extends Error { constructor() { super("The AI provider timed out. Please try again."); this.name = "AiProviderTimeoutError"; } }
export class GenerationDeadlineError extends Error { constructor() { super("Exam generation reached its execution limit. Please try a smaller exam."); this.name = "GenerationDeadlineError"; } }
export async function generateExam(params: GenerateExamParams): Promise<GeneratedExam> {
  if (!AI_CONFIG.apiKey) throw new Error(`${AI_CONFIG.apiKeyEnv} is not set for AI_PROVIDER=${AI_CONFIG.provider}. Add it to .env.local to enable exam generation.`);
  const deadline = Date.now() + AI_CONFIG.generationBudgetMs;
  const complete = async (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, responseFormat?: StructuredResponseFormat) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new GenerationDeadlineError();
    const signal = AbortSignal.timeout(Math.min(AI_CONFIG.providerTimeoutMs, remaining));
    let completion;
    for (let attempt = 0; ; attempt++) {
    try {
      completion = await aiClient.chat.completions.create({
        model: AI_CONFIG.model,
        temperature: 0.3,
        max_tokens: AI_CONFIG.provider === "groq" ? 2048 : 8192,
        // NVIDIA NIM supports the OpenAI-compatible JSON-object response
        // contract. Enforcing it here keeps the parser from receiving
        // malformed prose or partially escaped JSON from the model.
        response_format: responseFormat ?? (AI_CONFIG.provider === "groq" || AI_CONFIG.provider === "openai"
          ? { type: "json_schema", json_schema: { name: "generation_payload", strict: true, schema: { type: "object", additionalProperties: true } } }
          : { type: "json_object" }),
        ...(AI_CONFIG.provider === "groq" ? { reasoning_effort: "low" as const } : {}),
        messages,
      }, { signal });
    }
    catch (error) {
      if (signal.aborted) throw remaining <= AI_CONFIG.providerTimeoutMs ? new GenerationDeadlineError() : new AiProviderTimeoutError();
      const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
      if (AI_CONFIG.provider === "groq" && status === 429 && attempt < 2) {
        const headers = typeof error === "object" && error !== null && "headers" in error ? error.headers as { get?: (name: string) => string | null } : undefined;
        const retryAfter = headers?.get?.("retry-after") ?? headers?.get?.("x-ratelimit-reset-requests") ?? "1";
        const seconds = Number(retryAfter);
        const waitMs = Math.max(1000, (Number.isFinite(seconds) ? seconds * 1000 : 1000) + 250);
        if (waitMs >= remaining) throw new GenerationDeadlineError();
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw error;
    }
    break;
    }
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("The AI returned an empty response. Please try again.");
    return raw;
  };
  let sections;
  try { sections = await generateQuestionContentWithCompletion(params, complete); }
  catch (error) { throw new Error(`Question-generation stage failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  let marking;
  try { marking = await generateMarkingContentWithCompletion({ blueprint: params.blueprint, questions: sections }, complete); }
  catch (error) { throw new Error(`Marking-generation stage failed: ${error instanceof Error ? error.message : "unknown error"}`); }
  const exam: GeneratedExam = { instructions: params.blueprint.assessmentProfile?.generalInstructions.join("\n") ?? "Answer all questions.", sections, marking_scheme: marking };
  const violations = describeViolations(exam, params.blueprint);
  if (violations.length) throw new Error(`Staged exam validation failed: ${violations.join("; ")}`);
  return exam;
}
