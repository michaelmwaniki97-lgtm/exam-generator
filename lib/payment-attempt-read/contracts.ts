import { PAYMENT_CURRENCY, PaymentError, type PaymentAttempt, type PaymentStatus } from "../payments/core.ts";

export const PAYMENT_ATTEMPT_SELECT = "id, exam_id, teacher_id, amount, currency, phone, provider, status, external_request_id, provider_request_id, provider_reference, created_at, completed_at";
export const REUSABLE_PAYMENT_STATUSES = ["initiated", "pending", "paid"] as const;

export type PaymentAttemptRow = {
  id: string;
  exam_id: string;
  teacher_id: string;
  amount: number;
  currency: string;
  phone: string;
  provider: string;
  status: string;
  external_request_id: string | null;
  provider_request_id: string | null;
  provider_reference: string | null;
  created_at: string | Date;
  completed_at: string | Date | null;
};

function timestamp(value: string | Date): string { return value instanceof Date ? value.toISOString() : value; }

export function normalizePaymentAttempt(row: PaymentAttemptRow): PaymentAttempt {
  if (!Number.isSafeInteger(row.amount) || row.currency !== PAYMENT_CURRENCY || !["initiated", "pending", "paid", "failed", "cancelled", "expired"].includes(row.status)) {
    throw new PaymentError("VERIFICATION_FAILED", "Stored payment data is invalid.");
  }
  return {
    id: row.id,
    examId: row.exam_id,
    teacherId: row.teacher_id,
    amount: row.amount,
    currency: PAYMENT_CURRENCY,
    phone: row.phone,
    provider: row.provider,
    status: row.status as PaymentStatus,
    externalRequestId: row.external_request_id,
    providerRequestId: row.provider_request_id,
    providerReference: row.provider_reference,
    createdAt: timestamp(row.created_at),
    completedAt: row.completed_at ? timestamp(row.completed_at) : null,
  };
}

export interface PaymentAttemptReadRepository {
  getAttempt(paymentId: string): Promise<PaymentAttempt | null>;
  getAttemptByExternalRequest(provider: string, externalRequestId: string): Promise<PaymentAttempt | null>;
  getLatestAttemptForExam(teacherId: string, examId: string): Promise<PaymentAttempt | null>;
}
