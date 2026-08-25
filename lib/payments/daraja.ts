import { createHash } from "node:crypto";
import { PaymentError, type PaymentProvider, type ProviderCheck, type ProviderInitiation } from "./core.ts";
import { classifyNetworkFailure, logDarajaTelemetry, safeDarajaResponseFields } from "./telemetry.ts";

const SANDBOX_ORIGIN = "https://sandbox.safaricom.co.ke";
const PRODUCTION_ORIGIN = "https://api.safaricom.co.ke";
const RESPONSE_LIMIT = 32_768;
const REQUEST_TIMEOUT_MS = 15_000;

export type DarajaEnvironment = "sandbox" | "production";
export type DarajaTransactionType = "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
export type DarajaConfig = {
  environment: DarajaEnvironment;
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  partyB: string;
  passkey: string;
  transactionType: DarajaTransactionType;
  callbackUrl: string;
  oauthUrl: string;
  stkPushUrl: string;
  queryUrl: string;
};

type Environment = Record<string, string | undefined>;
type Fetch = typeof fetch;

function required(env: Environment, name: string, maximum = 512): string {
  const value = env[name];
  if (!value || value.trim() !== value || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured.");
  return value;
}

function configuredHttpsUrl(value: string, expectedHost?: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (expectedHost && url.hostname !== expectedHost)) throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured.");
  return url;
}

export function loadDarajaConfig(env: Environment): DarajaConfig {
  if (env.PAYMENT_PROVIDER !== "daraja") throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured.");
  const environment = required(env, "MPESA_ENVIRONMENT", 16);
  if (environment !== "sandbox" && environment !== "production") throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured.");
  const transactionType = required(env, "MPESA_TRANSACTION_TYPE", 32);
  if (transactionType !== "CustomerPayBillOnline" && transactionType !== "CustomerBuyGoodsOnline") throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured.");
  const businessShortCode = required(env, "MPESA_BUSINESS_SHORTCODE", 16);
  const partyB = required(env, "MPESA_PARTY_B", 16);
  if (!/^\d{5,12}$/.test(businessShortCode) || !/^\d{5,12}$/.test(partyB)) throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured.");
  const appUrl = configuredHttpsUrl(required(env, "PUBLIC_APP_URL", 512));
  if (appUrl.search || appUrl.pathname !== "/") throw new PaymentError("NOT_CONFIGURED", "M-Pesa payment service is not configured.");
  const origin = environment === "sandbox" ? SANDBOX_ORIGIN : PRODUCTION_ORIGIN;
  const queryUrl = environment === "sandbox"
    ? `${SANDBOX_ORIGIN}/mpesa/stkpushquery/v1/query`
    : configuredHttpsUrl(required(env, "MPESA_QUERY_URL", 512), "api.safaricom.co.ke").toString();
  return {
    environment,
    consumerKey: required(env, "MPESA_CONSUMER_KEY", 256),
    consumerSecret: required(env, "MPESA_CONSUMER_SECRET", 256),
    businessShortCode,
    partyB,
    passkey: required(env, "MPESA_PASSKEY", 512),
    transactionType,
    callbackUrl: new URL("/api/payments/mpesa/callback", appUrl).toString(),
    oauthUrl: `${origin}/oauth/v1/generate?grant_type=client_credentials`,
    stkPushUrl: `${origin}/mpesa/stkpush/v1/processrequest`,
    queryUrl,
  };
}

export function darajaTimestamp(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new PaymentError("VERIFICATION_FAILED", "Payment request could not be started.");
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()].map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0")).join("");
}

export function darajaPassword(shortCode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`, "utf8").toString("base64");
}

export function darajaAccountReference(paymentId: string): string {
  return `EX${createHash("sha256").update(paymentId).digest("hex").slice(0, 10)}`.toUpperCase();
}

function boundedString(value: unknown, maximum: number): value is string { return typeof value === "string" && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value); }
function resultCode(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^\d{1,10}$/.test(value)) return Number(value);
  return null;
}

async function boundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > RESPONSE_LIMIT) throw new PaymentError("VERIFICATION_FAILED", "Payment provider returned an invalid response.");
  if (!response.body) throw new PaymentError("VERIFICATION_FAILED", "Payment provider returned an invalid response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > RESPONSE_LIMIT) { await reader.cancel(); throw new PaymentError("VERIFICATION_FAILED", "Payment provider returned an invalid response."); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new PaymentError("VERIFICATION_FAILED", "Payment provider returned an invalid response."); }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PaymentError("VERIFICATION_FAILED", "Payment provider returned an invalid response.");
  return value as Record<string, unknown>;
}

export type DarajaCallback = {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDescription: string;
  amount?: number;
  receipt?: string;
  phone?: string;
};

export function parseDarajaCallback(value: unknown): DarajaCallback {
  const root = record(value), body = record(root.Body), callback = record(body.stkCallback);
  if (!boundedString(callback.MerchantRequestID, 160) || !boundedString(callback.CheckoutRequestID, 160) || typeof callback.ResultCode !== "number" || !Number.isSafeInteger(callback.ResultCode) || !boundedString(callback.ResultDesc, 500)) throw new PaymentError("VERIFICATION_FAILED", "Invalid payment callback.");
  const parsed: DarajaCallback = { merchantRequestId: callback.MerchantRequestID, checkoutRequestId: callback.CheckoutRequestID, resultCode: callback.ResultCode, resultDescription: callback.ResultDesc };
  if (callback.CallbackMetadata !== undefined) {
    const metadata = record(callback.CallbackMetadata);
    if (!Array.isArray(metadata.Item) || metadata.Item.length > 20) throw new PaymentError("VERIFICATION_FAILED", "Invalid payment callback.");
    const seen = new Set<string>();
    for (const raw of metadata.Item) {
      const item = record(raw);
      if (!boundedString(item.Name, 64) || seen.has(item.Name)) throw new PaymentError("VERIFICATION_FAILED", "Invalid payment callback.");
      seen.add(item.Name);
      if (item.Name === "Amount") { if (typeof item.Value !== "number" || !Number.isFinite(item.Value) || item.Value <= 0) throw new PaymentError("VERIFICATION_FAILED", "Invalid payment callback."); parsed.amount = item.Value; }
      else if (item.Name === "MpesaReceiptNumber") { if (!boundedString(item.Value, 80) || !/^[A-Za-z0-9]+$/.test(item.Value)) throw new PaymentError("VERIFICATION_FAILED", "Invalid payment callback."); parsed.receipt = item.Value; }
      else if (item.Name === "PhoneNumber") { const phone = typeof item.Value === "number" ? String(item.Value) : item.Value; if (typeof phone !== "string" || !/^254[17]\d{8}$/.test(phone)) throw new PaymentError("VERIFICATION_FAILED", "Invalid payment callback."); parsed.phone = phone; }
      else if (item.Name === "TransactionDate" && !((typeof item.Value === "number" && Number.isSafeInteger(item.Value)) || (typeof item.Value === "string" && /^\d{14}$/.test(item.Value)))) throw new PaymentError("VERIFICATION_FAILED", "Invalid payment callback.");
      else if (item.Value !== undefined && !["string", "number"].includes(typeof item.Value)) throw new PaymentError("VERIFICATION_FAILED", "Invalid payment callback.");
    }
  }
  return parsed;
}

export class DarajaPaymentProvider implements PaymentProvider {
  readonly id = "daraja";
  private token: { value: string; expiresAt: number } | null = null;
  private config: DarajaConfig;
  private fetcher: Fetch;
  private now: () => Date;
  constructor(config: DarajaConfig, fetcher: Fetch = fetch, now: () => Date = () => new Date()) { this.config = config; this.fetcher = fetcher; this.now = now; }

  private async request(stage: "oauth" | "stk_push" | null, url: string, init: RequestInit): Promise<Record<string, unknown>> {
    if (stage) logDarajaTelemetry({ stage, event: "request_started", environment: this.config.environment });
    let response: Response;
    try { response = await this.fetcher(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }); }
    catch (error) {
      if (stage) logDarajaTelemetry({ stage, event: "terminal_failure", environment: this.config.environment, ...classifyNetworkFailure(stage, error) });
      throw new PaymentError("VERIFICATION_FAILED", "M-Pesa service is temporarily unavailable.");
    }
    let json: unknown;
    try { json = await boundedJson(response); }
    catch (error) {
      if (stage) logDarajaTelemetry({ stage, event: "terminal_failure", environment: this.config.environment, classification: stage === "oauth" ? "oauth_rejected" : "stk_rejected", httpStatus: response.status });
      throw error;
    }
    const safeFields = stage ? safeDarajaResponseFields(stage, json) : {};
    if (stage) logDarajaTelemetry({ stage, event: "response", environment: this.config.environment, httpStatus: response.status, ...safeFields });
    if (!response.ok) {
      if (stage) logDarajaTelemetry({ stage, event: "terminal_failure", environment: this.config.environment, classification: stage === "oauth" ? "oauth_rejected" : "stk_rejected", httpStatus: response.status, ...safeFields });
      throw new PaymentError("VERIFICATION_FAILED", "M-Pesa service rejected the request.");
    }
    try { return record(json); }
    catch (error) {
      if (stage) logDarajaTelemetry({ stage, event: "terminal_failure", environment: this.config.environment, classification: stage === "oauth" ? "oauth_rejected" : "stk_rejected", httpStatus: response.status, ...safeFields });
      throw error;
    }
  }

  private async accessToken(): Promise<string> {
    const now = this.now().getTime();
    if (this.token && this.token.expiresAt - 60_000 > now) return this.token.value;
    const basic = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`, "utf8").toString("base64");
    const json = await this.request("oauth", this.config.oauthUrl, { method: "GET", headers: { Authorization: `Basic ${basic}`, Accept: "application/json" } });
    if (!boundedString(json.access_token, 4096) || typeof json.expires_in !== "number" || !Number.isSafeInteger(json.expires_in) || json.expires_in < 60 || json.expires_in > 86_400) {
      logDarajaTelemetry({ stage: "oauth", event: "terminal_failure", environment: this.config.environment, classification: "oauth_rejected" });
      throw new PaymentError("VERIFICATION_FAILED", "M-Pesa service returned an invalid authentication response.");
    }
    this.token = { value: json.access_token, expiresAt: now + json.expires_in * 1000 };
    return this.token.value;
  }

  private async authorizedPost(url: string, body: Record<string, unknown>, telemetryStage: "stk_push" | null = null): Promise<Record<string, unknown>> {
    const token = await this.accessToken();
    return this.request(telemetryStage, url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  }

  async initiate(input: { paymentId: string; examId: string; amount: number; currency: "KES"; phone: string }): Promise<ProviderInitiation> {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.currency !== "KES" || !/^254[17]\d{8}$/.test(input.phone)) {
      logDarajaTelemetry({ stage: "stk_push", event: "terminal_failure", environment: this.config.environment, classification: "other" });
      throw new PaymentError("VERIFICATION_FAILED", "Payment request could not be started.");
    }
    let timestamp: string;
    try { timestamp = darajaTimestamp(this.now()); }
    catch (error) {
      logDarajaTelemetry({ stage: "stk_push", event: "terminal_failure", environment: this.config.environment, classification: "other" });
      throw error;
    }
    const json = await this.authorizedPost(this.config.stkPushUrl, { BusinessShortCode: this.config.businessShortCode, Password: darajaPassword(this.config.businessShortCode, this.config.passkey, timestamp), Timestamp: timestamp, TransactionType: this.config.transactionType, Amount: input.amount, PartyA: input.phone, PartyB: this.config.partyB, PhoneNumber: input.phone, CallBackURL: this.config.callbackUrl, AccountReference: darajaAccountReference(input.paymentId), TransactionDesc: "Exam download" }, "stk_push");
    if (!boundedString(json.ResponseCode, 16) || !boundedString(json.ResponseDescription, 500)) {
      logDarajaTelemetry({ stage: "stk_push", event: "terminal_failure", environment: this.config.environment, classification: "stk_rejected", ...safeDarajaResponseFields("stk_push", json) });
      throw new PaymentError("VERIFICATION_FAILED", "M-Pesa service returned an invalid initiation response.");
    }
    if (json.ResponseCode !== "0") {
      logDarajaTelemetry({ stage: "stk_push", event: "terminal_failure", environment: this.config.environment, classification: "stk_rejected", ...safeDarajaResponseFields("stk_push", json) });
      return { accepted: false, safeMessage: "Payment request could not be started." };
    }
    if (!boundedString(json.MerchantRequestID, 160) || !boundedString(json.CheckoutRequestID, 160) || !boundedString(json.CustomerMessage, 500)) {
      logDarajaTelemetry({ stage: "stk_push", event: "terminal_failure", environment: this.config.environment, classification: "stk_rejected", ...safeDarajaResponseFields("stk_push", json) });
      throw new PaymentError("VERIFICATION_FAILED", "M-Pesa service returned an invalid initiation response.");
    }
    return { accepted: true, providerRequestId: json.MerchantRequestID, externalRequestId: json.CheckoutRequestID, safeMessage: "Check your phone to complete the M-Pesa payment." };
  }

  async checkStatus(input: { paymentId: string; externalRequestId: string; providerRequestId?: string | null }): Promise<ProviderCheck> {
    if (!boundedString(input.externalRequestId, 160)) throw new PaymentError("VERIFICATION_FAILED", "Payment could not be verified.");
    const timestamp = darajaTimestamp(this.now());
    const json = await this.authorizedPost(this.config.queryUrl, { BusinessShortCode: this.config.businessShortCode, Password: darajaPassword(this.config.businessShortCode, this.config.passkey, timestamp), Timestamp: timestamp, CheckoutRequestID: input.externalRequestId });
    if (!boundedString(json.ResponseCode, 16) || !boundedString(json.ResponseDescription, 500) || !boundedString(json.MerchantRequestID, 160) || (input.providerRequestId && json.MerchantRequestID !== input.providerRequestId) || !boundedString(json.CheckoutRequestID, 160) || json.CheckoutRequestID !== input.externalRequestId || !boundedString(json.ResultDesc, 500)) throw new PaymentError("VERIFICATION_FAILED", "M-Pesa service returned an invalid status response.");
    const code = resultCode(json.ResultCode);
    if (code === null) throw new PaymentError("VERIFICATION_FAILED", "M-Pesa service returned an invalid status response.");
    if (json.ResponseCode !== "0") return { status: "failed", resultCode: String(code), safeMessage: "Payment failed." };
    if (code === 0) return { status: "paid", resultCode: "0" };
    if (code === 1032) return { status: "cancelled", resultCode: "1032", safeMessage: "Payment was cancelled." };
    return { status: "failed", resultCode: String(code), safeMessage: "Payment failed." };
  }
}
