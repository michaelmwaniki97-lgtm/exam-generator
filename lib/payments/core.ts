export const PAYMENT_CURRENCY = "KES" as const;
export const PRICE_LIMITS = { minimum: 1, maximum: 100_000 } as const;
export const ACTIVE_PAYMENT_STATUSES = ["initiated", "pending"] as const;
export type PaymentStatus = "initiated" | "pending" | "paid" | "failed" | "cancelled" | "expired";

export class PaymentError extends Error {
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_PHONE" | "INVALID_PRICE" | "NOT_CONFIGURED" | "VERIFICATION_FAILED";
  constructor(code: PaymentError["code"], message: string) { super(message); this.code = code; }
}

export function validateExamPackagePrice(value: unknown): number {
  const amount = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(amount) || amount < PRICE_LIMITS.minimum || amount > PRICE_LIMITS.maximum) throw new PaymentError("INVALID_PRICE", `Price must be a whole KES amount between ${PRICE_LIMITS.minimum} and ${PRICE_LIMITS.maximum}.`);
  return amount;
}

export function normalizeKenyanPhone(value: unknown): string {
  if (typeof value !== "string") throw new PaymentError("INVALID_PHONE", "Enter a valid Kenyan M-Pesa phone number.");
  const input = value.trim();
  let normalized: string;
  if (/^0[17]\d{8}$/.test(input)) normalized = `254${input.slice(1)}`;
  else if (/^\+?254[17]\d{8}$/.test(input)) normalized = input.replace(/^\+/, "");
  else throw new PaymentError("INVALID_PHONE", "Enter a valid Kenyan M-Pesa phone number.");
  return normalized;
}

export function maskKenyanPhone(phone: string): string { return `${phone.slice(0, 6)}***${phone.slice(-3)}`; }
export function maskProviderReference(reference: string | null): string | null { return reference && reference.length > 6 ? `${reference.slice(0, 3)}***${reference.slice(-3)}` : reference; }
export function mayDownloadExamPackage(role: "teacher" | "admin" | null, ownsExam: boolean, hasPaidPayment: boolean): boolean { return role === "admin" || (role === "teacher" && ownsExam && hasPaidPayment); }

export type PaymentAttempt = {
  id: string; examId: string; teacherId: string; amount: number; currency: typeof PAYMENT_CURRENCY;
  phone: string; provider: string; status: PaymentStatus; externalRequestId: string | null;
  providerRequestId: string | null; providerReference: string | null; createdAt: string; completedAt: string | null;
};
export type BeginAttemptResult = { attempt: PaymentAttempt; created: boolean };
export type PaymentActor = { userId: string; teacherId: string; role: "teacher" | "admin" };

export type ProviderInitiation = { accepted: boolean; externalRequestId?: string; providerRequestId?: string; safeMessage?: string };
export type ProviderCheck =
  | { status: "pending" }
  | { status: "failed" | "cancelled" | "expired"; resultCode?: string; safeMessage?: string }
  | { status: "paid"; amount?: number; currency?: typeof PAYMENT_CURRENCY; providerReference?: string; resultCode?: string };

export interface PaymentProvider {
  readonly id: string;
  initiate(input: { paymentId: string; examId: string; amount: number; currency: typeof PAYMENT_CURRENCY; phone: string }): Promise<ProviderInitiation>;
  checkStatus(input: { paymentId: string; externalRequestId: string; providerRequestId?: string | null }): Promise<ProviderCheck>;
}

export interface PaymentRepository {
  assertOwnedExam(actor: PaymentActor, examId: string): Promise<void>;
  beginAttempt(input: { examId: string; teacherId: string; phone: string; provider: string; idempotencyKey: string }): Promise<BeginAttemptResult>;
  saveInitiation(paymentId: string, result: ProviderInitiation): Promise<PaymentAttempt>;
  getAttempt(paymentId: string): Promise<PaymentAttempt | null>;
  getAttemptByExternalRequest(externalRequestId: string): Promise<PaymentAttempt | null>;
  getLatestAttemptForExam(actor: PaymentActor, examId: string): Promise<PaymentAttempt | null>;
  finalizePaid(input: { paymentId: string; examId: string; teacherId: string; provider: string; amount: number; currency: typeof PAYMENT_CURRENCY; providerReference: string; providerReceipt?: string; resultCode?: string }): Promise<boolean>;
  recordTerminal(paymentId: string, status: "failed" | "cancelled" | "expired", resultCode?: string, safeMessage?: string): Promise<void>;
}

export async function initiateExamPayment(input: { actor: PaymentActor | null; examId: string; phone: unknown; idempotencyKey: string; repository: PaymentRepository; provider: PaymentProvider }) {
  if (!input.actor) throw new PaymentError("UNAUTHENTICATED", "Authentication required.");
  const phone = normalizeKenyanPhone(input.phone);
  await input.repository.assertOwnedExam(input.actor, input.examId);
  const begun = await input.repository.beginAttempt({ examId: input.examId, teacherId: input.actor.teacherId, phone, provider: input.provider.id, idempotencyKey: input.idempotencyKey });
  if (begun.attempt.status === "paid" || !begun.created || begun.attempt.externalRequestId) return { attempt: begun.attempt, reused: true };
  let providerResult: ProviderInitiation;
  try { providerResult = await input.provider.initiate({ paymentId: begun.attempt.id, examId: input.examId, amount: begun.attempt.amount, currency: begun.attempt.currency, phone }); }
  catch { await input.repository.recordTerminal(begun.attempt.id, "failed", undefined, "Payment request could not be started."); throw new PaymentError("NOT_CONFIGURED", "Payment request could not be started."); }
  const attempt = await input.repository.saveInitiation(begun.attempt.id, providerResult);
  return { attempt, reused: false };
}

function checkoutReference(provider: string, externalRequestId: string): string {
  const value = `${provider}-checkout-${externalRequestId}`;
  if (value.length < 4 || value.length > 80) throw new PaymentError("VERIFICATION_FAILED", "Payment could not be verified.");
  return value;
}

export async function reconcilePayment(input: { paymentId: string; repository: PaymentRepository; provider: PaymentProvider; providerReceipt?: string }): Promise<PaymentStatus> {
  const attempt = await input.repository.getAttempt(input.paymentId);
  if (!attempt || attempt.provider !== input.provider.id || !attempt.externalRequestId) throw new PaymentError("VERIFICATION_FAILED", "Payment could not be verified.");
  if (attempt.status === "paid") {
    if (!input.providerReceipt) return "paid";
    if (!attempt.providerReference) throw new PaymentError("VERIFICATION_FAILED", "Payment could not be verified.");
    const retained = await input.repository.finalizePaid({ paymentId: attempt.id, examId: attempt.examId, teacherId: attempt.teacherId, provider: attempt.provider, amount: attempt.amount, currency: attempt.currency, providerReference: attempt.providerReference, providerReceipt: input.providerReceipt });
    if (!retained) throw new PaymentError("VERIFICATION_FAILED", "Payment could not be verified.");
    return "paid";
  }
  if (!ACTIVE_PAYMENT_STATUSES.includes(attempt.status as (typeof ACTIVE_PAYMENT_STATUSES)[number])) return attempt.status;
  const result = await input.provider.checkStatus({ paymentId: attempt.id, externalRequestId: attempt.externalRequestId, providerRequestId: attempt.providerRequestId });
  if (result.status === "pending") return "pending";
  if (result.status !== "paid") { await input.repository.recordTerminal(attempt.id, result.status, result.resultCode, result.safeMessage); return result.status; }
  const paid = await input.repository.finalizePaid({ paymentId: attempt.id, examId: attempt.examId, teacherId: attempt.teacherId, provider: attempt.provider, amount: result.amount ?? attempt.amount, currency: result.currency ?? attempt.currency, providerReference: result.providerReference ?? checkoutReference(attempt.provider, attempt.externalRequestId), providerReceipt: input.providerReceipt, resultCode: result.resultCode });
  if (!paid) throw new PaymentError("VERIFICATION_FAILED", "Payment could not be verified.");
  return "paid";
}

export class FakePaymentProvider implements PaymentProvider {
  readonly id = "fake";
  initiations = 0;
  private result: ProviderCheck;
  private accepts: boolean;
  constructor(result: ProviderCheck = { status: "pending" }, accepts = true) { this.result = result; this.accepts = accepts; }
  async initiate(input: { paymentId: string }): Promise<ProviderInitiation> { this.initiations += 1; return this.accepts ? { accepted: true, providerRequestId: `fake-merchant-${input.paymentId}`, externalRequestId: `fake-${input.paymentId}` } : { accepted: false, safeMessage: "Payment request could not be started." }; }
  async checkStatus(): Promise<ProviderCheck> { return this.result; }
  setResult(result: ProviderCheck) { this.result = result; }
}
