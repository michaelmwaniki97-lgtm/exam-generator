import "server-only";

import type { PaymentAttempt } from "../payments/core.ts";
import { queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { normalizePaymentAttempt, type PaymentAttemptReadRepository, type PaymentAttemptRow } from "./contracts.ts";

const PROJECTION = `id, exam_id, teacher_id, amount, currency, phone, provider, status,
  external_request_id, provider_request_id, provider_reference, created_at, completed_at`;

async function trustedRows(sql: string, values: unknown[]): Promise<PaymentAttemptRow[] | null> {
  try { return await withTrustedTransaction((client) => queryRows<PaymentAttemptRow>(client, sql, values)); }
  catch { return null; }
}

function exactlyOne(rows: PaymentAttemptRow[] | null): PaymentAttempt | null {
  return rows?.length === 1 ? normalizePaymentAttempt(rows[0]) : null;
}

export class PostgresPaymentAttemptReadRepository implements PaymentAttemptReadRepository {
  async getAttempt(paymentId: string): Promise<PaymentAttempt | null> {
    return exactlyOne(await trustedRows(`select ${PROJECTION} from public.payments where id = $1::uuid`, [paymentId]));
  }

  async getAttemptByExternalRequest(provider: string, externalRequestId: string): Promise<PaymentAttempt | null> {
    return exactlyOne(await trustedRows(
      `select ${PROJECTION} from public.payments where provider = $1 and external_request_id = $2`,
      [provider, externalRequestId]));
  }

  async getLatestAttemptForExam(teacherId: string, examId: string): Promise<PaymentAttempt | null> {
    return exactlyOne(await trustedRows(
      `select ${PROJECTION} from public.payments
        where exam_id = $1::uuid and teacher_id = $2::uuid and status = any($3::text[])
        order by created_at desc limit 1`,
      [examId, teacherId, ["initiated", "pending", "paid"]]));
  }
}
