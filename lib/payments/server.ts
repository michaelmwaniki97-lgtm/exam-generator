import "server-only";
import { createAdminClient } from "../supabase/admin";
import { createClient } from "../supabase/server";
import { getCurrentUser, getUserRole } from "../auth/session";
import { mayDownloadExamPackage, PaymentError, PAYMENT_CURRENCY, validateExamPackagePrice, type BeginAttemptResult, type PaymentActor, type PaymentAttempt, type PaymentRepository, type ProviderInitiation } from "./core";

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
  const supabase = await createClient();
  const { data } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  return data ? { userId: user.id, teacherId: data.id, role: "teacher" } : null;
}

export async function getExamPackagePrice(): Promise<number> {
  const { data, error } = await createAdminClient().from("app_settings").select("value").eq("key", "exam_package_price").maybeSingle();
  if (error || !data || typeof data.value !== "object" || data.value === null || Array.isArray(data.value)) throw new PaymentError("NOT_CONFIGURED", "Exam download pricing is not configured.");
  return validateExamPackagePrice((data.value as Record<string, unknown>).amount);
}

export async function getExamDownloadEntitlement(examId: string): Promise<{ allowed: boolean; admin: boolean; price: number | null }> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user) throw new PaymentError("UNAUTHENTICATED", "Authentication required.");
  if (mayDownloadExamPackage(role, false, false)) return { allowed: true, admin: true, price: null };
  const supabase = await createClient();
  const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (!teacher) throw new PaymentError("FORBIDDEN", "Access denied.");
  const { data: exam } = await supabase.from("exams").select("id, status").eq("id", examId).eq("teacher_id", teacher.id).maybeSingle();
  if (!exam) throw new PaymentError("NOT_FOUND", "Exam not found.");
  const { data: paid } = await supabase.from("payments").select("id").eq("exam_id", examId).eq("teacher_id", teacher.id).eq("status", "paid").limit(1);
  const allowed = mayDownloadExamPackage(role, true, !!paid?.length || exam.status === "paid" || exam.status === "downloaded");
  return { allowed, admin: false, price: allowed ? null : await getExamPackagePrice() };
}

export class SupabasePaymentRepository implements PaymentRepository {
  private admin = createAdminClient();
  async assertOwnedExam(actor: PaymentActor, examId: string) {
    const { data } = await this.admin.from("exams").select("id").eq("id", examId).eq("teacher_id", actor.teacherId).maybeSingle();
    if (!data) throw new PaymentError("FORBIDDEN", "You do not have access to this exam.");
  }
  async beginAttempt(input: { examId: string; teacherId: string; phone: string; provider: string; idempotencyKey: string }): Promise<BeginAttemptResult> {
    const { data, error } = await this.admin.rpc("begin_payment_attempt", { p_exam_id: input.examId, p_teacher_id: input.teacherId, p_phone: input.phone, p_provider: input.provider, p_idempotency_key: input.idempotencyKey });
    if (error || !data) throw new PaymentError("NOT_CONFIGURED", "Payment request could not be started.");
    const row = (Array.isArray(data) ? data[0] : data) as PaymentRow;
    return { attempt: attempt(row), created: row.idempotency_key === input.idempotencyKey } as BeginAttemptResult;
  }
  async saveInitiation(paymentId: string, result: ProviderInitiation): Promise<PaymentAttempt> {
    const changes = result.accepted && result.externalRequestId && result.providerRequestId ? { status: "pending", verification_status: "pending", external_request_id: result.externalRequestId, provider_request_id: result.providerRequestId, result_description: result.safeMessage?.slice(0, 500) ?? null, updated_at: new Date().toISOString() } : { status: "failed", verification_status: "rejected", result_description: result.safeMessage?.slice(0, 500) ?? "Payment request failed.", updated_at: new Date().toISOString() };
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
  async finalizePaid(input: { paymentId: string; examId: string; teacherId: string; provider: string; amount: number; currency: "KES"; providerReference: string; providerReceipt?: string; resultCode?: string }) {
    const { data, error } = await this.admin.rpc("finalize_verified_payment", { p_payment_id: input.paymentId, p_exam_id: input.examId, p_teacher_id: input.teacherId, p_provider: input.provider, p_amount: input.amount, p_currency: input.currency, p_provider_reference: input.providerReference, p_mpesa_receipt: input.providerReceipt ?? null, p_result_code: input.resultCode ?? null, p_result_description: null });
    return !error && data === true;
  }
  async recordTerminal(paymentId: string, status: "failed" | "cancelled" | "expired", resultCode?: string, safeMessage?: string) { await this.admin.from("payments").update({ status, verification_status: "rejected", result_code: resultCode?.slice(0, 80), result_description: safeMessage?.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", paymentId).in("status", ["initiated", "pending"]); }
}
