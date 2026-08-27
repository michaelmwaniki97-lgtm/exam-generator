import "server-only";

import { queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import type { PaymentAttemptRow } from "../payment-attempt-read/contracts.ts";
import type { InitiationStateChanges, PaymentStateWriteRepository } from "./contracts.ts";

const PROJECTION = `id, exam_id, teacher_id, amount, currency, phone, provider, status,
  external_request_id, provider_request_id, provider_reference, created_at, completed_at`;

export class PostgresPaymentStateWriteRepository implements PaymentStateWriteRepository {
  async saveInitiation(paymentId: string, changes: InitiationStateChanges): Promise<PaymentAttemptRow | null> {
    try {
      const rows = await withTrustedTransaction(async (client) => changes.status === "pending"
        ? queryRows<PaymentAttemptRow>(client,
          `update public.payments
              set status = 'pending', verification_status = 'pending',
                  external_request_id = $2::text, provider_request_id = $3::text,
                  result_description = $4::text, query_next_at = $5::timestamptz,
                  updated_at = $6::timestamptz
            where id = $1::uuid and status = 'initiated'
            returning ${PROJECTION}`,
          [paymentId, changes.external_request_id, changes.provider_request_id,
            changes.result_description, changes.query_next_at, changes.updated_at])
        : queryRows<PaymentAttemptRow>(client,
          `update public.payments
              set status = 'failed', verification_status = 'rejected',
                  result_description = $2::text, updated_at = $3::timestamptz
            where id = $1::uuid and status = 'initiated'
            returning ${PROJECTION}`,
          [paymentId, changes.result_description, changes.updated_at]));
      return rows.length === 1 ? rows[0] : null;
    } catch { return null; }
  }

  async recordTerminal(
    paymentId: string,
    status: "failed" | "cancelled" | "expired",
    resultCode: string | undefined,
    resultDescription: string | undefined,
    updatedAt: string
  ): Promise<void> {
    try {
      await withTrustedTransaction((client) => client.query(
        `update public.payments
            set status = $2::text, verification_status = 'rejected',
                result_code = case when $3::boolean then $4::text else result_code end,
                result_description = case when $5::boolean then $6::text else result_description end,
                updated_at = $7::timestamptz
          where id = $1::uuid and status = any($8::text[])`,
        [paymentId, status, resultCode !== undefined, resultCode ?? null,
          resultDescription !== undefined, resultDescription ?? null, updatedAt,
          ["initiated", "pending"]]
      ));
    } catch {
      // Historical terminal-state persistence is best-effort.
    }
  }
}
