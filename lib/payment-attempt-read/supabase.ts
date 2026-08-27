import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentAttempt } from "../payments/core.ts";
import { normalizePaymentAttempt, PAYMENT_ATTEMPT_SELECT, REUSABLE_PAYMENT_STATUSES, type PaymentAttemptReadRepository, type PaymentAttemptRow } from "./contracts.ts";

export class SupabasePaymentAttemptReadRepository implements PaymentAttemptReadRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async getAttempt(paymentId: string): Promise<PaymentAttempt | null> {
    const { data } = await this.client.from("payments").select(PAYMENT_ATTEMPT_SELECT).eq("id", paymentId).maybeSingle();
    return data ? normalizePaymentAttempt(data as unknown as PaymentAttemptRow) : null;
  }

  async getAttemptByExternalRequest(provider: string, externalRequestId: string): Promise<PaymentAttempt | null> {
    const { data } = await this.client.from("payments").select(PAYMENT_ATTEMPT_SELECT)
      .eq("provider", provider).eq("external_request_id", externalRequestId).maybeSingle();
    return data ? normalizePaymentAttempt(data as unknown as PaymentAttemptRow) : null;
  }

  async getLatestAttemptForExam(teacherId: string, examId: string): Promise<PaymentAttempt | null> {
    const { data } = await this.client.from("payments").select(PAYMENT_ATTEMPT_SELECT)
      .eq("exam_id", examId).eq("teacher_id", teacherId).in("status", [...REUSABLE_PAYMENT_STATUSES])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ? normalizePaymentAttempt(data as unknown as PaymentAttemptRow) : null;
  }
}
