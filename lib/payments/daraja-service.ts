import { PaymentError, reconcilePayment, type PaymentActor, type PaymentProvider, type PaymentRepository, type PaymentStatus } from "./core.ts";
import type { DarajaCallback } from "./daraja.ts";

export type CallbackOutcome = "ignored" | PaymentStatus;

export async function processDarajaCallback(input: { callback: DarajaCallback; repository: PaymentRepository; provider: PaymentProvider }): Promise<CallbackOutcome> {
  const attempt = await input.repository.getAttemptByExternalRequest(input.callback.checkoutRequestId);
  if (!attempt || attempt.provider !== "daraja" || input.provider.id !== "daraja") return "ignored";
  if (!attempt.providerRequestId || attempt.providerRequestId !== input.callback.merchantRequestId) return "ignored";
  if (input.callback.amount !== undefined && input.callback.amount !== attempt.amount) return "ignored";
  if (input.callback.phone !== undefined && input.callback.phone !== attempt.phone) return "ignored";
  return reconcilePayment({ paymentId: attempt.id, repository: input.repository, provider: input.provider, providerReceipt: input.callback.resultCode === 0 ? input.callback.receipt : undefined });
}

export async function reconcileOwnedExamPayment(input: { actor: PaymentActor | null; examId: string; repository: PaymentRepository; provider: PaymentProvider }): Promise<PaymentStatus> {
  if (!input.actor) throw new PaymentError("UNAUTHENTICATED", "Authentication required.");
  const attempt = await input.repository.getLatestAttemptForExam(input.actor, input.examId);
  if (!attempt) throw new PaymentError("NOT_FOUND", "No payment request was found for this exam.");
  return reconcilePayment({ paymentId: attempt.id, repository: input.repository, provider: input.provider });
}
