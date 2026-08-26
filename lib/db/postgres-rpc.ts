import "server-only";

import type { AiClaimRow, AuthenticatedRpcDatabase, ReadyTextbookRow, TextbookChunkRow, TrustedRpcDatabase } from "./contracts.ts";
import { queryRows, withAuthenticatedTransaction, withTrustedTransaction } from "./postgres-client.ts";

function scalar<Row extends Record<string, unknown>, Key extends keyof Row>(rows: Row[], key: Key): Row[Key] {
  if (rows.length !== 1) throw new Error("Database function returned an unexpected row count.");
  return rows[0][key];
}

export class PostgresAuthenticatedRpcDatabase implements AuthenticatedRpcDatabase {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  listReadyTextbooks(input: { subjectId: string; gradeId: string }) {
    return withAuthenticatedTransaction(this.userId, (client) => queryRows<ReadyTextbookRow>(client,
      "select id, name, publisher from public.list_ready_textbooks($1::uuid, $2::uuid)",
      [input.subjectId, input.gradeId]
    ));
  }
}

export class PostgresTrustedRpcDatabase implements TrustedRpcDatabase {
  async importVerifiedCurriculum(payload: unknown) {
    return withTrustedTransaction(async (client) => scalar(await queryRows<{ result: unknown }>(client,
      "select public.import_verified_curriculum($1::jsonb) as result", [payload]
    ), "result"));
  }

  matchTextbookChunks(input: { textbookId: string; queryEmbedding: number[]; limit: number; documentId?: string }) {
    const vector = `[${input.queryEmbedding.join(",")}]`;
    return withTrustedTransaction((client) => queryRows<TextbookChunkRow>(client,
      "select chunk_id, document_id, textbook_id, page_start, page_end, text, relevance_score from public.match_textbook_chunks($1::uuid, $2::extensions.vector, $3::integer, $4::uuid)",
      [input.textbookId, vector, input.limit, input.documentId ?? null]
    ));
  }

  claimAiGeneration(input: { teacherId: string; requestKey: string }) {
    return withTrustedTransaction((client) => queryRows<AiClaimRow>(client,
      "select outcome, reservation_id, result_exam_id, result_revision from public.claim_ai_generation($1::uuid, $2::uuid)",
      [input.teacherId, input.requestKey]
    ));
  }

  claimAiRegeneration(input: { teacherId: string; examId: string; slotId: string; requestKey: string; expectedRevision: number }) {
    return withTrustedTransaction((client) => queryRows<AiClaimRow>(client,
      "select outcome, reservation_id, result_exam_id, result_revision from public.claim_ai_regeneration($1::uuid, $2::uuid, $3::text, $4::uuid, $5::integer)",
      [input.teacherId, input.examId, input.slotId, input.requestKey, input.expectedRevision]
    ));
  }

  async persistGeneratedExam(input: { teacherId: string; reservationId: string; requestKey: string; subjectId: string; gradeId: string; examType: string; marks: number; duration: number; difficulty: string; term: string; year: number; examContent: unknown; markingContent: unknown }) {
    return withTrustedTransaction(async (client) => String(scalar(await queryRows<{ result: string }>(client,
      "select public.persist_generated_exam_and_complete_ai_operation($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::text, $7::integer, $8::integer, $9::text, $10::text, $11::integer, $12::jsonb, $13::jsonb) as result",
      [input.teacherId, input.reservationId, input.requestKey, input.subjectId, input.gradeId, input.examType, input.marks, input.duration, input.difficulty, input.term, input.year, input.examContent, input.markingContent]
    ), "result")));
  }

  async persistRegeneratedExam(input: { teacherId: string; reservationId: string; requestKey: string; examId: string; slotId: string; expectedRevision: number; examContent: unknown; markingContent: unknown }) {
    return withTrustedTransaction(async (client) => Number(scalar(await queryRows<{ result: number }>(client,
      "select public.persist_regenerated_exam_and_complete_ai_operation($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::integer, $7::jsonb, $8::jsonb) as result",
      [input.teacherId, input.reservationId, input.requestKey, input.examId, input.slotId, input.expectedRevision, input.examContent, input.markingContent]
    ), "result")));
  }

  async failAiOperation(input: { teacherId: string; reservationId: string }) {
    return withTrustedTransaction(async (client) => scalar(await queryRows<{ result: boolean }>(client,
      "select public.fail_ai_operation($1::uuid, $2::uuid) as result", [input.teacherId, input.reservationId]
    ), "result"));
  }

  async updateExamAndSchemeAtomic(input: { examId: string; teacherId: string; expectedRevision: number; examContent: unknown; markingContent: unknown }) {
    return withTrustedTransaction(async (client) => Number(scalar(await queryRows<{ result: number }>(client,
      "select public.update_exam_and_scheme_atomic($1::uuid, $2::uuid, $3::integer, $4::jsonb, $5::jsonb) as result",
      [input.examId, input.teacherId, input.expectedRevision, input.examContent, input.markingContent]
    ), "result")));
  }

  async beginPaymentAttempt(input: { examId: string; teacherId: string; phone: string; provider: string; idempotencyKey: string }) {
    return withTrustedTransaction(async (client) => {
      const rows = await queryRows<Record<string, unknown>>(client,
        "select (public.begin_payment_attempt($1::uuid, $2::uuid, $3::text, $4::text, $5::uuid)).*",
        [input.examId, input.teacherId, input.phone, input.provider, input.idempotencyKey]
      );
      if (rows.length !== 1) throw new Error("Database function returned an unexpected row count.");
      return rows[0];
    });
  }

  async acquirePaymentQueryLease(input: { paymentId: string; leaseToken: string }) {
    return withTrustedTransaction(async (client) => scalar(await queryRows<{ result: boolean }>(client,
      "select public.acquire_payment_query_lease($1::uuid, $2::uuid) as result", [input.paymentId, input.leaseToken]
    ), "result"));
  }

  async completePaymentQueryLease(input: { paymentId: string; leaseToken: string }) {
    return withTrustedTransaction(async (client) => scalar(await queryRows<{ result: boolean }>(client,
      "select public.complete_payment_query_lease($1::uuid, $2::uuid) as result", [input.paymentId, input.leaseToken]
    ), "result"));
  }

  async finalizeVerifiedPayment(input: { paymentId: string; examId: string; teacherId: string; provider: string; amount: number; currency: string; providerReference: string; providerReceipt?: string; resultCode?: string; resultDescription?: string }) {
    return withTrustedTransaction(async (client) => scalar(await queryRows<{ result: boolean }>(client,
      "select public.finalize_verified_payment($1::uuid, $2::uuid, $3::uuid, $4::text, $5::integer, $6::text, $7::text, $8::text, $9::text, $10::text) as result",
      [input.paymentId, input.examId, input.teacherId, input.provider, input.amount, input.currency, input.providerReference, input.providerReceipt ?? null, input.resultCode ?? null, input.resultDescription ?? null]
    ), "result"));
  }
}
