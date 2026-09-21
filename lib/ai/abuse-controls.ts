import "server-only";

import { UUID_PATTERN } from "../admin/validation";
import { getTrustedRpcDatabase } from "../db";
import {
  AiAbuseControlError,
  developmentGenerationQuotaBypassEnabled,
  reservationError,
  type AiReservationClaim,
} from "./abuse-controls-core";

type ClaimRow = {
  outcome: AiReservationClaim["outcome"];
  reservation_id: string | null;
  result_exam_id: string | null;
  result_revision: number | null;
};

function requestKey(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new AiAbuseControlError("INVALID_REQUEST", "The generation request is invalid. Please try again.");
  }
  return value;
}

function parseClaim(data: unknown, operation: "generation" | "regeneration"): AiReservationClaim {
  const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | null;
  if (!row) throw new AiAbuseControlError("UNAVAILABLE", "Generation controls are temporarily unavailable.");
  if (row.outcome === "acquired" && row.reservation_id) return { outcome: "acquired", reservationId: row.reservation_id };
  if (row.outcome === "completed" && row.reservation_id) {
    if (operation === "generation" && row.result_exam_id) {
      return { outcome: "completed", reservationId: row.reservation_id, operation, examId: row.result_exam_id };
    }
    if (operation === "regeneration" && Number.isInteger(row.result_revision) && Number(row.result_revision) > 0) {
      return { outcome: "completed", reservationId: row.reservation_id, operation, resultRevision: Number(row.result_revision) };
    }
  }
  if (["duplicate_active", "busy", "quota_exceeded", "terminal", "stale"].includes(row.outcome)) {
    return { outcome: row.outcome as "duplicate_active" | "busy" | "quota_exceeded" | "terminal" | "stale" };
  }
  throw new AiAbuseControlError("UNAVAILABLE", "Generation controls are temporarily unavailable.");
}

export async function claimFullGeneration(teacherId: string, requestId: string): Promise<AiReservationClaim> {
  try {
    const database = getTrustedRpcDatabase();
    const key = requestKey(requestId);
    const claim = parseClaim(await database.claimAiGeneration({ teacherId, requestKey: key }), "generation");
    if (claim.outcome === "quota_exceeded" && developmentGenerationQuotaBypassEnabled()) {
      await database.resetDevelopmentGenerationQuota({ teacherId });
      return parseClaim(await database.claimAiGeneration({ teacherId, requestKey: key }), "generation");
    }
    return claim;
  } catch {
    throw new AiAbuseControlError("UNAVAILABLE", "Generation controls are temporarily unavailable.");
  }
}

export async function claimQuestionRegeneration(input: {
  teacherId: string;
  examId: string;
  slotId: string;
  requestId: string;
  expectedRevision: number;
}): Promise<AiReservationClaim> {
  try {
    return parseClaim(await getTrustedRpcDatabase().claimAiRegeneration({
      teacherId: input.teacherId, examId: input.examId, slotId: input.slotId,
      requestKey: requestKey(input.requestId), expectedRevision: input.expectedRevision,
    }), "regeneration");
  } catch {
    throw new AiAbuseControlError("UNAVAILABLE", "Regeneration controls are temporarily unavailable.");
  }
}

export async function persistGeneratedExam(input: {
  teacherId: string;
  reservationId: string;
  requestId: string;
  exam: {
    subjectId: string;
    gradeId: string;
    examType: string;
    marks: number;
    duration: number;
    difficulty: "easy" | "medium" | "hard";
    term: string;
    year: number;
    content: unknown;
  };
  markingContent: unknown;
}): Promise<string> {
  let data: string;
  try {
    data = await getTrustedRpcDatabase().persistGeneratedExam({
      teacherId: input.teacherId, reservationId: input.reservationId, requestKey: requestKey(input.requestId),
      subjectId: input.exam.subjectId, gradeId: input.exam.gradeId, examType: input.exam.examType,
      marks: input.exam.marks, duration: input.exam.duration, difficulty: input.exam.difficulty,
      term: input.exam.term, year: input.exam.year, examContent: input.exam.content, markingContent: input.markingContent,
    });
  } catch {
    throw new AiAbuseControlError("UNAVAILABLE", "The generated exam could not be saved safely.");
  }
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) throw new AiAbuseControlError("UNAVAILABLE", "The generated exam could not be saved safely.");
  return data;
}

export async function persistRegeneratedQuestion(input: {
  teacherId: string;
  reservationId: string;
  requestId: string;
  examId: string;
  slotId: string;
  expectedRevision: number;
  examContent: unknown;
  markingContent: unknown;
}): Promise<number> {
  let data: number;
  try {
    data = await getTrustedRpcDatabase().persistRegeneratedExam({
      teacherId: input.teacherId, reservationId: input.reservationId, requestKey: requestKey(input.requestId),
      examId: input.examId, slotId: input.slotId, expectedRevision: input.expectedRevision,
      examContent: input.examContent, markingContent: input.markingContent,
    });
  } catch {
    throw new AiAbuseControlError("UNAVAILABLE", "The regenerated question could not be saved safely.");
  }
  const revision = Number(data);
  if (!Number.isInteger(revision) || revision < 1) {
    throw new AiAbuseControlError("UNAVAILABLE", "The regenerated question could not be saved safely.");
  }
  return revision;
}

export async function failAiReservation(teacherId: string, reservationId: string): Promise<void> {
  try {
    await getTrustedRpcDatabase().failAiOperation({ teacherId, reservationId });
  } catch {
    console.error("[AI Abuse Controls] reservation release failed");
  }
}

export function acquiredOrThrow(claim: AiReservationClaim, operation: "generation" | "regeneration") {
  if (claim.outcome === "acquired" || claim.outcome === "completed") return claim;
  throw reservationError(claim, operation);
}
