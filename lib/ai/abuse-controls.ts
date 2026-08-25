import "server-only";

import { UUID_PATTERN } from "../admin/validation";
import { createAdminClient } from "../supabase/admin";
import {
  AiAbuseControlError,
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
  const { data, error } = await createAdminClient().rpc("claim_ai_generation", {
    p_teacher_id: teacherId,
    p_request_key: requestKey(requestId),
  });
  if (error) throw new AiAbuseControlError("UNAVAILABLE", "Generation controls are temporarily unavailable.");
  return parseClaim(data, "generation");
}

export async function claimQuestionRegeneration(input: {
  teacherId: string;
  examId: string;
  slotId: string;
  requestId: string;
  expectedRevision: number;
}): Promise<AiReservationClaim> {
  const { data, error } = await createAdminClient().rpc("claim_ai_regeneration", {
    p_teacher_id: input.teacherId,
    p_exam_id: input.examId,
    p_slot_id: input.slotId,
    p_request_key: requestKey(input.requestId),
    p_expected_revision: input.expectedRevision,
  });
  if (error) throw new AiAbuseControlError("UNAVAILABLE", "Regeneration controls are temporarily unavailable.");
  return parseClaim(data, "regeneration");
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
  const { data, error } = await createAdminClient().rpc("persist_generated_exam_and_complete_ai_operation", {
    p_teacher_id: input.teacherId,
    p_reservation_id: input.reservationId,
    p_request_key: requestKey(input.requestId),
    p_subject_id: input.exam.subjectId,
    p_grade_id: input.exam.gradeId,
    p_exam_type: input.exam.examType,
    p_marks: input.exam.marks,
    p_duration: input.exam.duration,
    p_difficulty: input.exam.difficulty,
    p_term: input.exam.term,
    p_year: input.exam.year,
    p_exam_content: input.exam.content,
    p_marking_content: input.markingContent,
  });
  if (error || typeof data !== "string" || !UUID_PATTERN.test(data)) {
    throw new AiAbuseControlError("UNAVAILABLE", "The generated exam could not be saved safely.");
  }
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
  const { data, error } = await createAdminClient().rpc("persist_regenerated_exam_and_complete_ai_operation", {
    p_teacher_id: input.teacherId,
    p_reservation_id: input.reservationId,
    p_request_key: requestKey(input.requestId),
    p_exam_id: input.examId,
    p_slot_id: input.slotId,
    p_expected_revision: input.expectedRevision,
    p_exam_content: input.examContent,
    p_marking_content: input.markingContent,
  });
  const revision = Number(data);
  if (error || !Number.isInteger(revision) || revision < 1) {
    throw new AiAbuseControlError("UNAVAILABLE", "The regenerated question could not be saved safely.");
  }
  return revision;
}

export async function failAiReservation(teacherId: string, reservationId: string): Promise<void> {
  const { error } = await createAdminClient().rpc("fail_ai_operation", {
    p_teacher_id: teacherId,
    p_reservation_id: reservationId,
  });
  if (error) console.error("[AI Abuse Controls] reservation release failed");
}

export function acquiredOrThrow(claim: AiReservationClaim, operation: "generation" | "regeneration") {
  if (claim.outcome === "acquired" || claim.outcome === "completed") return claim;
  throw reservationError(claim, operation);
}
