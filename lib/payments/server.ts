import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "../supabase/admin";
import { getTrustedRpcDatabase } from "../db";
import { getCurrentUser, getUserRole } from "../auth/session";
import { getIdentityReadRepository } from "../identity-read";
import { getAppSettingsReadRepository } from "../app-settings-read";
import { getPaymentEntitlementReadRepository } from "../payment-entitlement";
import { getTeacherExamReadContext, getTrustedExamReadRepository } from "../exam-read";
import { mayDownloadExamPackage, PaymentError, PAYMENT_CURRENCY, type BeginAttemptResult, type PaymentActor, type PaymentAttempt, type PaymentRepository, type ProviderInitiation } from "./core";

type PaymentRow = {
  id: string; exam_id: string; teacher_id: string; amount: number; currency: string; phone: string;
  provider: string; status: string; external_request_id: string | null; provider_reference: string | null;
  provider_request_id: string | null;
  idempotency_key: string; created_at: string; completed_at: string | null;
};

function attempt(row: PaymentRow): PaymentAttempt {
  if (!Number.isSafeInteger(row.amount) || row.currency !== PAYMENT_CURRENCY || !["initiated", "pending", "paid", "failed", "cancelled", "expired"].includes(row.status)) throw new PaymentError("VERIFICATION_FAILED", "Stored payment data is invalid.");
  return { id: row.id, examId: row.exam_id, teacherId: row.teacher_id, amount: row.amount, currency: PAYMENT_CURRENCY, phone: row.phone, provider: row.provider, status: row.status as PaymentAttempt["status"], externalRequestId: row.external_request_id, providerRequestId: row.provider_request_id, providerReference: row.provider_reference, createdAt: row.created_at, completedAt: row.completed_at };
}

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

export class SupabasePaymentRepository implements PaymentRepository {
  private admin = createAdminClient();
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
    const changes = result.accepted && result.externalRequestId && result.providerRequestId ? { status: "pending", verification_status: "pending", external_request_id: result.externalRequestId, provider_request_id: result.providerRequestId, result_description: result.safeMessage?.slice(0, 500) ?? null, query_next_at: new Date(now + 30_000).toISOString(), updated_at: new Date(now).toISOString() } : { status: "failed", verification_status: "rejected", result_description: result.safeMessage?.slice(0, 500) ?? "Payment request failed.", updated_at: new Date(now).toISOString() };
    const { data, error } = await this.admin.from("payments").update(changes).eq("id", paymentId).eq("status", "initiated").select("*").single();
    if (error || !data) throw new PaymentError("VERIFICATION_FAILED", "Payment request could not be recorded.");
    return attempt(data as PaymentRow);
  }
  async getAttempt(paymentId: string) { const { data } = await this.admin.from("payments").select("*").eq("id", paymentId).maybeSingle(); return data ? attempt(data as PaymentRow) : null; }
  async getAttemptByExternalRequest(externalRequestId: string) { const { data } = await this.admin.from("payments").select("*").eq("provider", "daraja").eq("external_request_id", externalRequestId).maybeSingle(); return data ? attempt(data as PaymentRow) : null; }
  async getLatestAttemptForExam(actor: PaymentActor, examId: string) {
    await this.assertOwnedExam(actor, examId);
    const { data } = await this.admin.from("payments").select("*").eq("exam_id", examId).eq("teacher_id", actor.teacherId).in("status", ["initiated", "pending", "paid"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ? attempt(data as PaymentRow) : null;
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
  async recordTerminal(paymentId: string, status: "failed" | "cancelled" | "expired", resultCode?: string, safeMessage?: string) { await this.admin.from("payments").update({ status, verification_status: "rejected", result_code: resultCode?.slice(0, 80), result_description: safeMessage?.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", paymentId).in("status", ["initiated", "pending"]); }
}
