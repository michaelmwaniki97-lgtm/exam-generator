"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { initiateExamPayment, PaymentError } from "@/lib/payments/core";
import { configuredPaymentProvider } from "@/lib/payments/provider-config";
import { currentPaymentActor, SupabasePaymentRepository } from "@/lib/payments/server";

export type PaymentActionState = { status: "error" | "pending" | "paid"; message: string } | undefined;

export async function initiatePaymentAction(examId: string, _state: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  try {
    const result = await initiateExamPayment({ actor: await currentPaymentActor(), examId, phone: formData.get("phone"), idempotencyKey: randomUUID(), repository: new SupabasePaymentRepository(), provider: configuredPaymentProvider() });
    revalidatePath(`/teacher/exams/${examId}`);
    return result.attempt.status === "paid" ? { status: "paid", message: "This exam package is already unlocked." } : { status: "pending", message: "Payment is awaiting confirmation." };
  } catch (error) {
    return { status: "error", message: error instanceof PaymentError ? error.message : "Payment request could not be started." };
  }
}
