import { AnthropicIncompleteResponseError, completeAnthropicWithDetails, type AnthropicUsage } from "./anthropic";
import { composeKenyanAssessmentStyle, stylePrompt } from "../assessment-style/profiles";
import "server-only";
import { aiClient } from "./client";
import { AI_CONFIG } from "./config";
import { saveDevelopmentFailureSnapshot, saveDevelopmentRejectedMarkingSnapshot, saveDevelopmentRejectedVisualSnapshot } from "./development-failure-snapshot";
import { classifyFinalValidation, describeGroundingProvenanceViolations, describeViolations, generateMarkingContentWithCompletion, generateQuestionContentWithCompletion, safeMarkingFailureReason, safeQuestionFailureReason, type ExamQuestion, type ExamSection, type GenerateExamCoreParams, type GeneratedExam, type MarkAllocation, type MarkingSchemeEntry, type StagedGenerationTelemetry, type TopicInput, type StructuredResponseFormat } from "./generation-core";

export type { ExamQuestion, ExamSection, GeneratedExam, MarkAllocation, MarkingSchemeEntry, TopicInput };
export type GenerateExamParams = GenerateExamCoreParams;
export class AiProviderTimeoutError extends Error { constructor() { super("The AI provider timed out. Please try again."); this.name = "AiProviderTimeoutError"; } }
export class GenerationDeadlineError extends Error { constructor() { super("Exam generation reached its execution limit. Please try a smaller exam."); this.name = "GenerationDeadlineError"; } }
export class FinalExamValidationError extends Error {
  constructor(public readonly diagnostics: import("./generation-core").FinalValidationDiagnostics) { super("The generated exam did not pass final validation."); this.name = "FinalExamValidationError"; }
}
export function validateFinalStagedExam(exam: GeneratedExam, blueprint: GenerateExamParams["blueprint"], textbookContext?: GenerateExamParams["textbookContext"]): void {
  const allViolations = describeViolations(exam, blueprint);
  // Reliability-first final validation:
  // question/resource integrity and structural marking correctness remain hard.
  // Marking-only semantic heuristics are advisory and cannot discard a complete exam.
  const violations = allViolations.filter((problem) => {
    const advisoryMarkingProblem =
      /^marking entry /i.test(problem) &&
      /generic marking notes|generic allocation|placeholder|merely restates|resource that is not validly attached|gives no worked numerical result/i.test(problem);

    // Existing low-mark breadth heuristic remains advisory as before.
    return !advisoryMarkingProblem && !/too broad/i.test(problem);
  });
  const groundingViolations = describeGroundingProvenanceViolations(exam, textbookContext);
  if (violations.length || groundingViolations.length) throw new FinalExamValidationError(classifyFinalValidation(exam, blueprint, violations, groundingViolations));
}
type ActiveGenerationWork = { stage: "questions"; batchIndex: number; retryNumber: number } | { stage: "marking"; entryIndex: number; slotId: string; retryNumber: number } | { stage: "validation" };
const generationStage = (active: ActiveGenerationWork): ActiveGenerationWork["stage"] => active.stage;
function safeErrorClassification(error: unknown): string {
  if (error instanceof Error && error.cause) return safeErrorClassification(error.cause);
  if (error instanceof GenerationDeadlineError) return "generation_deadline";
  if (error instanceof AiProviderTimeoutError) return "provider_timeout";
  const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
  if (status === 429) return "provider_rate_limit";
  if (status >= 500) return "provider_server_error";
  if (status >= 400) return "provider_request_error";
  return error instanceof SyntaxError ? "response_json_error" : "generation_error";
}
export async function generateExam(params: GenerateExamParams): Promise<GeneratedExam> {
  if (!AI_CONFIG.apiKey) throw new Error(`${AI_CONFIG.apiKeyEnv} is not set for AI_PROVIDER=${AI_CONFIG.provider}. Add it to .env.local to enable exam generation.`);
  const generationStartedAt = Date.now();
  const deadline = generationStartedAt + AI_CONFIG.generationBudgetMs;
  let active: ActiveGenerationWork = { stage: "questions", batchIndex: 1, retryNumber: 0 };
  let terminalProviderClassification: string | undefined;
  const usageTotals: Required<AnthropicUsage> = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const log = (event: string, details: Record<string, unknown>) => console.info("[Exam Generation]", JSON.stringify({ event, ...details }));
  const timing = (startedAt: number, completedAt: number) => ({ startedAt: new Date(startedAt).toISOString(), completedAt: new Date(completedAt).toISOString(), elapsedMs: completedAt - startedAt });
  const telemetry: StagedGenerationTelemetry = {
    questionAttemptStarted: ({ batchIndex, slotCount, retryNumber, startedAt }) => { active = { stage: "questions", batchIndex, retryNumber }; log("question_batch_started", { batchIndex, slotCount, retryNumber, startedAt: new Date(startedAt).toISOString() }); },
    questionAttemptCompleted: ({ batchIndex, slotCount, retryNumber, startedAt, completedAt, outcome, reason, retainedBatchCount }) => log("question_batch_completed", { batchIndex, slotCount, retryNumber, outcome, reason, retainedBatchCount, ...timing(startedAt, completedAt) }),
    questionVisualRejected: async (event) => { await saveDevelopmentRejectedVisualSnapshot(event); },
    markingRejected: async (event) => { await saveDevelopmentRejectedMarkingSnapshot(event); },
    markingAttemptStarted: ({ entryIndex, slotId, retryNumber, startedAt }) => { active = { stage: "marking", entryIndex, slotId, retryNumber }; log("marking_entry_started", { entryIndex, slotId, retryNumber, startedAt: new Date(startedAt).toISOString() }); },
    markingAttemptCompleted: ({ entryIndex, slotId, retryNumber, startedAt, completedAt, outcome, reason }) => log("marking_entry_completed", { entryIndex, slotId, retryNumber, outcome, reason, ...timing(startedAt, completedAt) }),
  };
  log("generation_started", { provider: AI_CONFIG.provider, model: AI_CONFIG.model, totalQuestionSlots: params.blueprint.questionSlots.length, totalMarks: params.blueprint.totalMarks, totalQuestionBatches: Math.ceil(params.blueprint.questionSlots.length / 2), startedAt: new Date(generationStartedAt).toISOString() });
  const complete = async (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, responseFormat?: StructuredResponseFormat) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      terminalProviderClassification = "generation_deadline";
      log("generation_deadline_reached", { condition: "before_provider_request", remainingDeadlineMs: remaining, active });
      throw new GenerationDeadlineError();
    }
    const signal = AbortSignal.timeout(Math.min(AI_CONFIG.providerTimeoutMs, remaining));
    let completion;
    for (let attempt = 0; ; attempt++) {
    try {
      if (AI_CONFIG.provider === "anthropic") {
        const maxTokens = active.stage === "questions" ? 8192 : active.stage === "marking" ? 2048 : 8192;
        try {
          const result = await completeAnthropicWithDetails({ apiKey: AI_CONFIG.apiKey!, model: AI_CONFIG.model, messages, signal, responseFormat, maxTokens });
          for (const key of Object.keys(usageTotals) as Array<keyof AnthropicUsage>) usageTotals[key] += result.usage[key] ?? 0;
          log("provider_usage", { provider: "anthropic", model: AI_CONFIG.model, stage: active.stage, ...(active.stage === "questions" ? { batchIndex: active.batchIndex, attempt: active.retryNumber } : active.stage === "marking" ? { entryIndex: active.entryIndex, slotId: active.slotId, attempt: active.retryNumber } : {}), inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, cacheReadTokens: result.usage.cacheReadTokens, cacheWriteTokens: result.usage.cacheWriteTokens, completionStatus: result.stopReason, maxTokens });
          return result.text;
        } catch (error) {
          if (error instanceof AnthropicIncompleteResponseError) {
            for (const key of Object.keys(usageTotals) as Array<keyof AnthropicUsage>) usageTotals[key] += error.usage[key] ?? 0;
            log("provider_usage", { provider: "anthropic", model: AI_CONFIG.model, stage: active.stage, ...(active.stage === "questions" ? { batchIndex: active.batchIndex, attempt: active.retryNumber } : active.stage === "marking" ? { entryIndex: active.entryIndex, slotId: active.slotId, attempt: active.retryNumber } : {}), inputTokens: error.usage.inputTokens, outputTokens: error.usage.outputTokens, cacheReadTokens: error.usage.cacheReadTokens, cacheWriteTokens: error.usage.cacheWriteTokens, completionStatus: error.stopReason ?? "incomplete", maxTokens });
          }
          throw error;
        }
      }
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
      if (signal.aborted) {
        const overallDeadlineExpiredFirst = remaining <= AI_CONFIG.providerTimeoutMs;
        terminalProviderClassification = overallDeadlineExpiredFirst ? "generation_deadline" : "provider_timeout";
        log(overallDeadlineExpiredFirst ? "generation_deadline_reached" : "provider_timeout", { condition: overallDeadlineExpiredFirst ? "provider_request_aborted_at_overall_deadline" : "provider_request_timeout", requestStartRemainingDeadlineMs: remaining, remainingDeadlineMs: deadline - Date.now(), active });
        throw overallDeadlineExpiredFirst ? new GenerationDeadlineError() : new AiProviderTimeoutError();
      }
      const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
      if (AI_CONFIG.provider === "groq" && status === 429 && attempt < 2) {
        const headers = typeof error === "object" && error !== null && "headers" in error ? error.headers as { get?: (name: string) => string | null } : undefined;
        const retryAfter = headers?.get?.("retry-after") ?? headers?.get?.("x-ratelimit-reset-requests") ?? "1";
        const seconds = Number(retryAfter);
        const waitMs = Math.max(1000, (Number.isFinite(seconds) ? seconds * 1000 : 1000) + 250);
        log("provider_rate_limit", { status: 429, retryNumber: attempt + 1, calculatedRetryWaitMs: waitMs, remainingDeadlineMs: deadline - Date.now(), active });
        if (waitMs >= remaining) {
          terminalProviderClassification = "generation_deadline";
          log("generation_deadline_reached", { condition: "rate_limit_wait_exceeds_remaining_deadline", calculatedRetryWaitMs: waitMs, requestStartRemainingDeadlineMs: remaining, remainingDeadlineMs: deadline - Date.now(), active });
          throw new GenerationDeadlineError();
        }
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
  try {
    let sections;
    try { sections = await generateQuestionContentWithCompletion(params, complete, telemetry); }
    catch (error) { throw new Error(`Question-generation stage failed: ${error instanceof Error ? error.message : "unknown error"}`, { cause: error }); }
    let marking;
    try { marking = await generateMarkingContentWithCompletion({ blueprint: params.blueprint, questions: sections, style: stylePrompt(composeKenyanAssessmentStyle(params)) }, complete, telemetry); }
    catch (error) { throw new Error(`Marking-generation stage failed: ${error instanceof Error ? error.message : "unknown error"}`, { cause: error }); }
    active = { stage: "validation" };
    const exam: GeneratedExam = { instructions: params.blueprint.assessmentProfile?.generalInstructions.join("\n") ?? "Answer all questions.", sections, marking_scheme: marking };
    try { validateFinalStagedExam(exam, params.blueprint, params.textbookContext); }
    catch (error) {
      if (!(error instanceof FinalExamValidationError)) throw error;
      const snapshot = await saveDevelopmentFailureSnapshot(exam, params.blueprint, error.diagnostics, params.textbookContext);
      log("final_validation_failed", { ...error.diagnostics, developmentSnapshot: snapshot });
      throw error;
    }
    const completedAt = Date.now();
    log("generation_completed", { outcome: "success", totalElapsedMs: completedAt - generationStartedAt, remainingDeadlineMs: deadline - completedAt, active, anthropicUsage: AI_CONFIG.provider === "anthropic" ? usageTotals : undefined });
    return exam;
  } catch (error) {
    const failedAt = Date.now();
    const cause = error instanceof Error && error.cause ? error.cause : error;
    log("generation_failed", { outcome: "failure", totalElapsedMs: failedAt - generationStartedAt, remainingDeadlineMs: deadline - failedAt, active, errorClassification: terminalProviderClassification ?? safeErrorClassification(cause), failureReason: cause instanceof FinalExamValidationError ? "final_deterministic_validation" : generationStage(active) === "questions" ? safeQuestionFailureReason(cause) : generationStage(active) === "marking" ? safeMarkingFailureReason(cause) : cause instanceof AnthropicIncompleteResponseError ? "provider_incomplete_or_refusal" : "generation_stage_failure", finalValidation: cause instanceof FinalExamValidationError ? cause.diagnostics : undefined, anthropicUsage: AI_CONFIG.provider === "anthropic" ? usageTotals : undefined });
    throw error;
  }
}
