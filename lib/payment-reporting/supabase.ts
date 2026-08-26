import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminPaymentReportingRepository, TeacherPaymentHistoryRow, TeacherPaymentReportingRepository } from "./contracts.ts";
import { wholeKesTotal } from "./contracts.ts";

export class SupabaseTeacherPaymentReportingRepository implements TeacherPaymentReportingRepository {
  private readonly client: SupabaseClient;
  private readonly teacherId: string;
  constructor(client: SupabaseClient, teacherId: string) { this.client = client; this.teacherId = teacherId; }

  async listTeacherPaymentHistory(): Promise<TeacherPaymentHistoryRow[]> {
    const { data } = await this.client.from("payments")
      .select("id, amount, currency, status, mpesa_ref, created_at, completed_at, exams(exam_type)")
      .eq("teacher_id", this.teacherId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((row) => {
      const payment = row as unknown as Omit<TeacherPaymentHistoryRow, "receiptReference"> & { mpesa_ref: string | null };
      const { mpesa_ref, ...fields } = payment;
      return { ...fields, receiptReference: mpesa_ref };
    });
  }
}

export class SupabaseAdminPaymentReportingRepository implements AdminPaymentReportingRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async getAdminPaidRevenue(): Promise<number> {
    const { data } = await this.client.from("payments").select("amount").eq("status", "paid");
    return wholeKesTotal((data ?? []).map((row) => row.amount as number | string));
  }
}
