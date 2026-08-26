import "server-only";

import type { PoolClient } from "pg";
import { queryRows, withAuthenticatedTransaction, withTrustedTransaction } from "../db/postgres-client.ts";
import type { AdminPaymentReportingRepository, TeacherPaymentHistoryRow, TeacherPaymentReportingRepository } from "./contracts.ts";
import { wholeKesTotal } from "./contracts.ts";

export class PostgresTeacherPaymentReportingRepository implements TeacherPaymentReportingRepository {
  private readonly userId: string;
  private readonly teacherId: string;
  constructor(userId: string, teacherId: string) { this.userId = userId; this.teacherId = teacherId; }

  private async authorize(): Promise<void> {
    const allowed = await withAuthenticatedTransaction(this.userId, async (client) => {
      const rows = await queryRows<{ id: string }>(client,
        "select id from public.teachers where id = $1::uuid and user_id = $2::uuid and not public.is_admin()",
        [this.teacherId, this.userId]);
      return rows.length === 1;
    });
    if (!allowed) throw new Error("Teacher access is required.");
  }

  async listTeacherPaymentHistory(): Promise<TeacherPaymentHistoryRow[]> {
    await this.authorize();
    return withTrustedTransaction(async (client) => {
      const rows = await queryRows<Omit<TeacherPaymentHistoryRow, "amount" | "created_at" | "completed_at"> & {
        amount: number | string;
        created_at: Date | string;
        completed_at: Date | string | null;
      }>(client,
        `select p.id, p.amount, p.currency, p.status, p.mpesa_ref as "receiptReference", p.created_at, p.completed_at,
                jsonb_build_object('exam_type', e.exam_type) as exams
           from public.payments p
           join public.exams e on e.id = p.exam_id
          where p.teacher_id = $1::uuid
          order by p.created_at desc
          limit 100`, [this.teacherId]);
      return rows.map((row) => ({
        ...row,
        amount: wholeKesTotal([row.amount]),
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        completed_at: row.completed_at instanceof Date ? row.completed_at.toISOString() : row.completed_at,
      }));
    });
  }
}

export class PostgresAdminPaymentReportingRepository implements AdminPaymentReportingRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  private run<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    return withAuthenticatedTransaction(this.userId, work);
  }

  async getAdminPaidRevenue(): Promise<number> {
    const rows = await this.run((client) => queryRows<{ total: string }>(client,
      "select coalesce(sum(amount), 0)::text as total from public.payments where status = 'paid' and public.is_admin()", []));
    return wholeKesTotal([rows[0]?.total ?? "0"]);
  }
}
