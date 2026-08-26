import "server-only";

import { queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type { PaymentEntitlementReadRepository } from "./contracts.ts";

export class PostgresPaymentEntitlementReadRepository implements PaymentEntitlementReadRepository {
  private readonly userId: string;
  private readonly teacherId: string;
  constructor(userId: string, teacherId: string) { this.userId = userId; this.teacherId = teacherId; }

  async hasSuccessfulPaymentForExam(examId: string): Promise<boolean> {
    try {
      return await withAuthenticatedTransaction(this.userId, async (client) => {
        const rows = await queryRows<{ id: string }>(client,
          `select id from public.payments
            where exam_id = $1::uuid and teacher_id = $2::uuid and status = 'paid' and not public.is_admin()
            limit 1`, [examId, this.teacherId]);
        return rows.length > 0;
      });
    } catch {
      return false;
    }
  }
}
