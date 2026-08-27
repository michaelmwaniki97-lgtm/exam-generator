import type { PaymentAttemptRow } from "../payment-attempt-read/contracts.ts";
import type { PaymentStatus } from "../payments/core.ts";

export type InitiationStateChanges =
  | {
      status: "pending";
      verification_status: "pending";
      external_request_id: string;
      provider_request_id: string;
      result_description: string | null;
      query_next_at: string;
      updated_at: string;
    }
  | {
      status: "failed";
      verification_status: "rejected";
      result_description: string;
      updated_at: string;
    };

export interface PaymentStateWriteRepository {
  saveInitiation(paymentId: string, changes: InitiationStateChanges): Promise<PaymentAttemptRow | null>;
  recordTerminal(
    paymentId: string,
    status: Extract<PaymentStatus, "failed" | "cancelled" | "expired">,
    resultCode: string | undefined,
    resultDescription: string | undefined,
    updatedAt: string
  ): Promise<void>;
}
