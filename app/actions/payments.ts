"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { initiateExamPayment, PaymentError } from "@/lib/payments/core";
import { configuredPaymentProvider } from "@/lib/payments/provider-config";
import { currentPaymentActor, ServerPaymentRepository } from "@/lib/payments/server";
import { reconcileOwnedExamPayment } from "@/lib/payments/daraja-service";

export type PaymentActionState = { status: "error" | "pending" | "paid"; message: string } | undefined;

export async function initiatePaymentAction(examId: string, _state: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  try {
    const result = await initiateExamPayment({ actor: await currentPaymentActor(), examId, phone: formData.get("phone"), idempotencyKey: randomUUID(), repository: new ServerPaymentRepository(), provider: configuredPaymentProvider() });
    revalidatePath(`/teacher/exams/${examId}`);
    return result.attempt.status === "paid" ? { status: "paid", message: "This exam package is already unlocked." } : { status: "pending", message: result.attempt.status === "pending" ? "STK Push sent. Check your phone, then check payment status." : "Payment is awaiting confirmation." };
  } catch (error) {
    return { status: "error", message: error instanceof PaymentError ? error.message : "Payment request could not be started." };
  }
}

export async function checkPaymentStatusAction(examId: string, _state: PaymentActionState, _formData: FormData): Promise<PaymentActionState> {
  void _state; void _formData;
  try {
    const status = await reconcileOwnedExamPayment({ actor: await currentPaymentActor(), examId, repository: new ServerPaymentRepository(), provider: configuredPaymentProvider() });
    revalidatePath(`/teacher/exams/${examId}`);
    if (status === "paid") return { status: "paid", message: "Payment confirmed. Both PDFs are now unlocked." };
    if (status === "cancelled") return { status: "error", message: "Payment was cancelled." };
    if (status === "failed" || status === "expired") return { status: "error", message: "Payment failed. You may start a new payment request." };
    return { status: "pending", message: "Payment is awaiting confirmation. Complete the prompt on your phone and check again." };
  } catch (error) {
    return { status: "error", message: error instanceof PaymentError ? error.message : "Payment status could not be checked." };
  }
}
