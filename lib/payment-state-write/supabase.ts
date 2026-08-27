import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYMENT_ATTEMPT_SELECT, type PaymentAttemptRow } from "../payment-attempt-read/contracts.ts";
import type { PaymentStateWriteRepository, InitiationStateChanges } from "./contracts.ts";

export class SupabasePaymentStateWriteRepository implements PaymentStateWriteRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async saveInitiation(paymentId: string, changes: InitiationStateChanges): Promise<PaymentAttemptRow | null> {
    const { data, error } = await this.client.from("payments").update(changes)
      .eq("id", paymentId).eq("status", "initiated").select(PAYMENT_ATTEMPT_SELECT).single();
    return error || !data ? null : data as unknown as PaymentAttemptRow;
  }

  async recordTerminal(
    paymentId: string,
    status: "failed" | "cancelled" | "expired",
    resultCode: string | undefined,
    resultDescription: string | undefined,
    updatedAt: string
  ): Promise<void> {
    await this.client.from("payments").update({
      status,
      verification_status: "rejected",
      result_code: resultCode,
      result_description: resultDescription,
      updated_at: updatedAt,
    }).eq("id", paymentId).in("status", ["initiated", "pending"]);
  }
}
