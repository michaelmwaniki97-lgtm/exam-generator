import type { ExamBlueprint } from "../blueprint/types.ts";
import { AI_OPERATION_TIMING, REGENERATION_LEASE_SECONDS } from "./timing.ts";

export const AI_ABUSE_LIMITS = {
  fullGenerationsPer24Hours: 10,
  regenerationsPer24Hours: 50,
  generationLeaseSeconds: 360,
  regenerationLeaseSeconds: REGENERATION_LEASE_SECONDS,
  regenerationProviderTimeoutMs: AI_OPERATION_TIMING.regenerationProviderTimeoutMs,
  regenerationBudgetMs: AI_OPERATION_TIMING.regenerationBudgetMs,
  questionBatchSize: 2,
  questionAttemptsPerBatch: 2,
  markingAttemptsPerSlot: 5,
  regenerationAttempts: 2,
  // Every supported blueprint has positive integer slot marks whose sum is
  // bounded by the existing 300-mark application/blueprint limit.
  maximumQuestionSlots: 300,
} as const;

export const MAX_GENERATION_PROVIDER_CALLS =
  Math.ceil(
    AI_ABUSE_LIMITS.maximumQuestionSlots / AI_ABUSE_LIMITS.questionBatchSize
  ) * AI_ABUSE_LIMITS.questionAttemptsPerBatch +
  AI_ABUSE_LIMITS.maximumQuestionSlots * AI_ABUSE_LIMITS.markingAttemptsPerSlot;

export type AiReservationClaim =
  | { outcome: "acquired"; reservationId: string }
  | { outcome: "completed"; reservationId: string; operation: "generation"; examId: string }
  | { outcome: "completed"; reservationId: string; operation: "regeneration"; resultRevision: number }
  | { outcome: "duplicate_active" | "busy" | "quota_exceeded" | "terminal" | "stale" };

export class AiAbuseControlError extends Error {
  readonly code:
    | "BUSY"
    | "QUOTA_EXCEEDED"
    | "INVALID_REQUEST"
    | "BUDGET_EXCEEDED"
    | "UNAVAILABLE";

  constructor(
    code:
      | "BUSY"
      | "QUOTA_EXCEEDED"
      | "INVALID_REQUEST"
      | "BUDGET_EXCEEDED"
      | "UNAVAILABLE",
    message: string
  ) {
    super(message);
    this.code = code;
    this.name = "AiAbuseControlError";
  }
}

export function assertGenerationProviderBudget(blueprint: ExamBlueprint): {
  questionSlots: number;
  maximumProviderCalls: number;
} {
  const questionSlots = blueprint.questionSlots.length;
  const maximumProviderCalls =
    Math.ceil(questionSlots / AI_ABUSE_LIMITS.questionBatchSize) *
      AI_ABUSE_LIMITS.questionAttemptsPerBatch +
    questionSlots * AI_ABUSE_LIMITS.markingAttemptsPerSlot;
  if (
    questionSlots < 1 ||
    questionSlots > AI_ABUSE_LIMITS.maximumQuestionSlots ||
    maximumProviderCalls > MAX_GENERATION_PROVIDER_CALLS
  ) {
    throw new AiAbuseControlError(
      "BUDGET_EXCEEDED",
      "This exam exceeds the supported generation budget. Please reduce its size."
    );
  }
  return { questionSlots, maximumProviderCalls };
}

export function reservationError(
  claim: Exclude<AiReservationClaim, { outcome: "acquired" | "completed" }>,
  operation: "generation" | "regeneration"
): AiAbuseControlError {
  if (claim.outcome === "quota_exceeded") {
    return new AiAbuseControlError(
      "QUOTA_EXCEEDED",
      operation === "generation"
        ? "Your daily exam-generation limit has been reached. Please try again later."
        : "Your daily question-regeneration limit has been reached. Please try again later."
    );
  }
  if (claim.outcome === "terminal") {
    return new AiAbuseControlError(
      "INVALID_REQUEST",
      "This request has already finished. Start a new request to try again."
    );
  }
  return new AiAbuseControlError(
    "BUSY",
    operation === "generation"
      ? "An exam generation is already in progress for your account."
      : "This question is already being regenerated."
  );
}

export function regenerationRequestTimeoutMs(now: number, deadline: number): number {
  const remaining = deadline - now;
  if (remaining <= 0) {
    throw new AiAbuseControlError(
      "BUDGET_EXCEEDED",
      "Question regeneration reached its execution limit. Please try again."
    );
  }
  return Math.min(AI_ABUSE_LIMITS.regenerationProviderTimeoutMs, remaining);
}
