import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseRpcError, type AiClaimRow, type AuthenticatedRpcDatabase, type ReadyTextbookRow, type TextbookChunkRow, type TrustedRpcDatabase } from "./contracts.ts";

async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new DatabaseRpcError(error.message, error.code);
  return data as T;
}

export class SupabaseAuthenticatedRpcDatabase implements AuthenticatedRpcDatabase {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  listReadyTextbooks(input: { subjectId: string; gradeId: string }) {
    return rpc<ReadyTextbookRow[]>(this.client, "list_ready_textbooks", { p_subject_id: input.subjectId, p_grade_id: input.gradeId });
  }
}

export class SupabaseTrustedRpcDatabase implements TrustedRpcDatabase {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  importVerifiedCurriculum(payload: unknown) {
    return rpc(this.client, "import_verified_curriculum", { p_payload: payload });
  }

  matchTextbookChunks(input: { textbookId: string; queryEmbedding: number[]; limit: number; documentId?: string }) {
    return rpc<TextbookChunkRow[]>(this.client, "match_textbook_chunks", { p_textbook_id: input.textbookId, p_query_embedding: `[${input.queryEmbedding.join(",")}]`, p_limit: input.limit, p_document_id: input.documentId ?? null });
  }

  updateExamAndSchemeAtomic(input: { examId: string; teacherId: string; expectedRevision: number; examContent: unknown; markingContent: unknown }) {
    return rpc<number>(this.client, "update_exam_and_scheme_atomic", { p_exam_id: input.examId, p_teacher_id: input.teacherId, p_expected_revision: input.expectedRevision, p_exam_content: input.examContent, p_marking_content: input.markingContent });
  }

  claimAiGeneration(input: { teacherId: string; requestKey: string }) {
    return rpc<AiClaimRow[]>(this.client, "claim_ai_generation", { p_teacher_id: input.teacherId, p_request_key: input.requestKey });
  }

  claimAiRegeneration(input: { teacherId: string; examId: string; slotId: string; requestKey: string; expectedRevision: number }) {
    return rpc<AiClaimRow[]>(this.client, "claim_ai_regeneration", { p_teacher_id: input.teacherId, p_exam_id: input.examId, p_slot_id: input.slotId, p_request_key: input.requestKey, p_expected_revision: input.expectedRevision });
  }

  persistGeneratedExam(input: { teacherId: string; reservationId: string; requestKey: string; subjectId: string; gradeId: string; examType: string; marks: number; duration: number; difficulty: string; term: string; year: number; examContent: unknown; markingContent: unknown }) {
    return rpc<string>(this.client, "persist_generated_exam_and_complete_ai_operation", { p_teacher_id: input.teacherId, p_reservation_id: input.reservationId, p_request_key: input.requestKey, p_subject_id: input.subjectId, p_grade_id: input.gradeId, p_exam_type: input.examType, p_marks: input.marks, p_duration: input.duration, p_difficulty: input.difficulty, p_term: input.term, p_year: input.year, p_exam_content: input.examContent, p_marking_content: input.markingContent });
  }

  persistRegeneratedExam(input: { teacherId: string; reservationId: string; requestKey: string; examId: string; slotId: string; expectedRevision: number; examContent: unknown; markingContent: unknown }) {
    return rpc<number>(this.client, "persist_regenerated_exam_and_complete_ai_operation", { p_teacher_id: input.teacherId, p_reservation_id: input.reservationId, p_request_key: input.requestKey, p_exam_id: input.examId, p_slot_id: input.slotId, p_expected_revision: input.expectedRevision, p_exam_content: input.examContent, p_marking_content: input.markingContent });
  }

  failAiOperation(input: { teacherId: string; reservationId: string }) {
    return rpc<boolean>(this.client, "fail_ai_operation", { p_teacher_id: input.teacherId, p_reservation_id: input.reservationId });
  }

  async beginPaymentAttempt(input: { examId: string; teacherId: string; phone: string; provider: string; idempotencyKey: string }) {
    const data = await rpc<Record<string, unknown> | Array<Record<string, unknown>>>(this.client, "begin_payment_attempt", { p_exam_id: input.examId, p_teacher_id: input.teacherId, p_phone: input.phone, p_provider: input.provider, p_idempotency_key: input.idempotencyKey });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new DatabaseRpcError("begin_payment_attempt returned no row.");
    return row;
  }

  acquirePaymentQueryLease(input: { paymentId: string; leaseToken: string }) {
    return rpc<boolean>(this.client, "acquire_payment_query_lease", { p_payment_id: input.paymentId, p_lease_token: input.leaseToken });
  }

  completePaymentQueryLease(input: { paymentId: string; leaseToken: string }) {
    return rpc<boolean>(this.client, "complete_payment_query_lease", { p_payment_id: input.paymentId, p_lease_token: input.leaseToken });
  }

  finalizeVerifiedPayment(input: { paymentId: string; examId: string; teacherId: string; provider: string; amount: number; currency: string; providerReference: string; providerReceipt?: string; resultCode?: string; resultDescription?: string }) {
    return rpc<boolean>(this.client, "finalize_verified_payment", { p_payment_id: input.paymentId, p_exam_id: input.examId, p_teacher_id: input.teacherId, p_provider: input.provider, p_amount: input.amount, p_currency: input.currency, p_provider_reference: input.providerReference, p_mpesa_receipt: input.providerReceipt ?? null, p_result_code: input.resultCode ?? null, p_result_description: input.resultDescription ?? null });
  }
}
