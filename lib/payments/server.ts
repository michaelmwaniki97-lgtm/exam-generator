import "server-only";
import { randomUUID } from "node:crypto";
import { getTrustedRpcDatabase } from "../db";
import { getCurrentUser, getUserRole } from "../auth/session";
import { getIdentityReadRepository } from "../identity-read";
import { getAppSettingsReadRepository } from "../app-settings-read";
import { getPaymentEntitlementReadRepository } from "../payment-entitlement";
import { getPaymentAttemptReadRepository, normalizePaymentAttempt, type PaymentAttemptRow } from "../payment-attempt-read";
import { getTeacherExamReadContext, getTrustedExamReadRepository } from "../exam-read";
import { getPaymentStateWriteRepository, type InitiationStateChanges } from "../payment-state-write";
import { mayDownloadExamPackage, PaymentError, type BeginAttemptResult, type PaymentActor, type PaymentAttempt, type PaymentRepository, type ProviderInitiation } from "./core";

type PaymentRow = PaymentAttemptRow & {
  idempotency_key: string;
};

const attempt = normalizePaymentAttempt;

export async function currentPaymentActor(): Promise<PaymentActor | null> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || role !== "teacher") return null;
  const teacher = await (await getIdentityReadRepository()).getTeacherIdentity();
  return teacher ? { userId: user.id, teacherId: teacher.id, role: "teacher" } : null;
}

export async function getExamPackagePrice(): Promise<number> {
  return getAppSettingsReadRepository().getExamPackagePrice();
}

export async function getExamDownloadEntitlement(examId: string): Promise<{ allowed: boolean; admin: boolean; price: number | null }> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user) throw new PaymentError("UNAUTHENTICATED", "Authentication required.");
  if (mayDownloadExamPackage(role, false, false)) return { allowed: true, admin: true, price: null };
  let repository: Awaited<ReturnType<typeof getTeacherExamReadContext>>["repository"];
  try {
    ({ repository } = await getTeacherExamReadContext());
  } catch (error) {
    if (error instanceof Error && error.message === "Teacher access required.") throw new PaymentError("FORBIDDEN", "Access denied.");
    throw error;
  }
  const exam = await repository.getTeacherExamPaymentMetadata(examId);
  if (!exam) throw new PaymentError("NOT_FOUND", "Exam not found.");
  const hasSuccessfulPayment = await (await getPaymentEntitlementReadRepository()).hasSuccessfulPaymentForExam(examId);
  const allowed = mayDownloadExamPackage(role, true, hasSuccessfulPayment || exam.status === "paid" || exam.status === "downloaded");
  return { allowed, admin: false, price: allowed ? null : await getExamPackagePrice() };
}

export class ServerPaymentRepository implements PaymentRepository {
  async assertOwnedExam(actor: PaymentActor, examId: string) {
    if (!await getTrustedExamReadRepository().teacherOwnsExam(examId, actor.teacherId)) throw new PaymentError("FORBIDDEN", "You do not have access to this exam.");
  }
  async beginAttempt(input: { examId: string; teacherId: string; phone: string; provider: string; idempotencyKey: string }): Promise<BeginAttemptResult> {
    let row: PaymentRow;
    try { row = await getTrustedRpcDatabase().beginPaymentAttempt(input) as PaymentRow; }
    catch { throw new PaymentError("NOT_CONFIGURED", "Payment request could not be started."); }
    return { attempt: attempt(row), created: row.idempotency_key === input.idempotencyKey } as BeginAttemptResult;
  }
  async saveInitiation(paymentId: string, result: ProviderInitiation): Promise<PaymentAttempt> {
    const now = Date.now();
    const changes: InitiationStateChanges = result.accepted && result.externalRequestId && result.providerRequestId ? { status: "pending", verification_status: "pending", external_request_id: result.externalRequestId, provider_request_id: result.providerRequestId, result_description: result.safeMessage?.slice(0, 500) ?? null, query_next_at: new Date(now + 30_000).toISOString(), updated_at: new Date(now).toISOString() } : { status: "failed", verification_status: "rejected", result_description: result.safeMessage?.slice(0, 500) ?? "Payment request failed.", updated_at: new Date(now).toISOString() };
    const data = await getPaymentStateWriteRepository().saveInitiation(paymentId, changes);
    if (!data) throw new PaymentError("VERIFICATION_FAILED", "Payment request could not be recorded.");
    return attempt(data);
  }
  async getAttempt(paymentId: string) { return getPaymentAttemptReadRepository().getAttempt(paymentId); }
  async getAttemptByExternalRequest(externalRequestId: string) { return getPaymentAttemptReadRepository().getAttemptByExternalRequest("daraja", externalRequestId); }
  async getLatestAttemptForExam(actor: PaymentActor, examId: string) {
    await this.assertOwnedExam(actor, examId);
    return getPaymentAttemptReadRepository().getLatestAttemptForExam(actor.teacherId, examId);
  }
  async acquireQueryLease(paymentId: string) {
    const leaseToken = randomUUID();
    try { return await getTrustedRpcDatabase().acquirePaymentQueryLease({ paymentId, leaseToken }) ? leaseToken : null; }
    catch { throw new PaymentError("VERIFICATION_FAILED", "Payment status could not be checked."); }
  }
  async completeQueryLease(paymentId: string, leaseToken: string) {
    try { return await getTrustedRpcDatabase().completePaymentQueryLease({ paymentId, leaseToken }); }
    catch { return false; }
  }
  async finalizePaid(input: { paymentId: string; examId: string; teacherId: string; provider: string; amount: number; currency: "KES"; providerReference: string; providerReceipt?: string; resultCode?: string }) {
    try { return await getTrustedRpcDatabase().finalizeVerifiedPayment(input); }
    catch { return false; }
  }
  async recordTerminal(paymentId: string, status: "failed" | "cancelled" | "expired", resultCode?: string, safeMessage?: string) {
    await getPaymentStateWriteRepository().recordTerminal(
      paymentId, status, resultCode?.slice(0, 80), safeMessage?.slice(0, 500), new Date().toISOString()
    );
  }
}
