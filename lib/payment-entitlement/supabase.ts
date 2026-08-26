import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentEntitlementReadRepository } from "./contracts.ts";

export class SupabasePaymentEntitlementReadRepository implements PaymentEntitlementReadRepository {
  private readonly client: SupabaseClient;
  private readonly teacherId: string;
  constructor(client: SupabaseClient, teacherId: string) { this.client = client; this.teacherId = teacherId; }

  async hasSuccessfulPaymentForExam(examId: string): Promise<boolean> {
    const { data } = await this.client.from("payments").select("id")
      .eq("exam_id", examId).eq("teacher_id", this.teacherId).eq("status", "paid").limit(1);
    return !!data?.length;
  }
}
