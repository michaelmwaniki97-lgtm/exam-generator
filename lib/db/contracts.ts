export type DatabaseBackendName = "supabase" | "postgres";

export type RpcErrorShape = { code?: string; message: string };

export class DatabaseRpcError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DatabaseRpcError";
    this.code = code;
  }
}

export type ReadyTextbookRow = { id: string; name: string; publisher: string | null };
export type AiClaimRow = {
  outcome: string;
  reservation_id: string | null;
  result_exam_id: string | null;
  result_revision: number | null;
};
export type TextbookChunkRow = {
  chunk_id: string;
  document_id: string;
  textbook_id: string;
  page_start: number;
  page_end: number;
  text: string;
  relevance_score: number;
};

export interface AuthenticatedRpcDatabase {
  listReadyTextbooks(input: { subjectId: string; gradeId: string }): Promise<ReadyTextbookRow[]>;
}

export interface TrustedRpcDatabase {
  importVerifiedCurriculum(payload: unknown): Promise<unknown>;
  matchTextbookChunks(input: { textbookId: string; queryEmbedding: number[]; limit: number; documentId?: string }): Promise<TextbookChunkRow[]>;
  updateExamAndSchemeAtomic(input: { examId: string; teacherId: string; expectedRevision: number; examContent: unknown; markingContent: unknown }): Promise<number>;
  claimAiGeneration(input: { teacherId: string; requestKey: string }): Promise<AiClaimRow[]>;
  resetDevelopmentGenerationQuota(input: { teacherId: string }): Promise<boolean>;
  claimAiRegeneration(input: { teacherId: string; examId: string; slotId: string; requestKey: string; expectedRevision: number }): Promise<AiClaimRow[]>;
  persistGeneratedExam(input: { teacherId: string; reservationId: string; requestKey: string; subjectId: string; gradeId: string; examType: string; marks: number; duration: number; difficulty: string; term: string; year: number; examContent: unknown; markingContent: unknown }): Promise<string>;
  persistRegeneratedExam(input: { teacherId: string; reservationId: string; requestKey: string; examId: string; slotId: string; expectedRevision: number; examContent: unknown; markingContent: unknown }): Promise<number>;
  failAiOperation(input: { teacherId: string; reservationId: string }): Promise<boolean>;
  beginPaymentAttempt(input: { examId: string; teacherId: string; phone: string; provider: string; idempotencyKey: string }): Promise<Record<string, unknown>>;
  acquirePaymentQueryLease(input: { paymentId: string; leaseToken: string }): Promise<boolean>;
  completePaymentQueryLease(input: { paymentId: string; leaseToken: string }): Promise<boolean>;
  finalizeVerifiedPayment(input: { paymentId: string; examId: string; teacherId: string; provider: string; amount: number; currency: string; providerReference: string; providerReceipt?: string; resultCode?: string; resultDescription?: string }): Promise<boolean>;
}
