export type DarajaTelemetryStage = "config" | "oauth" | "stk_push" | "persistence";
export type DarajaFailureClassification =
  | "config"
  | "oauth_rejected"
  | "oauth_network"
  | "stk_rejected"
  | "stk_network"
  | "persistence"
  | "other";

type SafeProviderFields = {
  code?: string;
  message?: string;
  merchantRequestIdReturned?: boolean;
  checkoutRequestIdReturned?: boolean;
};

const SAFE_TEXT_LIMIT = 500;

function safeText(value: unknown, maximum = SAFE_TEXT_LIMIT): string | undefined {
  if (typeof value !== "string" || !value || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  return value
    .replace(/(?:\+?254|0)[17]\d{8}/g, "[redacted-phone]")
    .replace(/[A-Za-z0-9+/=_-]{32,}/g, "[redacted-value]");
}

export function safeDarajaResponseFields(stage: "oauth" | "stk_push", value: unknown): SafeProviderFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const response = value as Record<string, unknown>;
  const code = safeText(stage === "stk_push" ? response.ResponseCode ?? response.errorCode : response.errorCode ?? response.error, 80);
  const message = safeText(stage === "stk_push" ? response.ResponseDescription ?? response.errorMessage : response.errorMessage ?? response.error_description);
  return {
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
    ...(stage === "stk_push" ? {
      merchantRequestIdReturned: typeof response.MerchantRequestID === "string" && response.MerchantRequestID.length > 0,
      checkoutRequestIdReturned: typeof response.CheckoutRequestID === "string" && response.CheckoutRequestID.length > 0,
    } : {}),
  };
}

export function classifyNetworkFailure(stage: "oauth" | "stk_push", error: unknown): {
  classification: "oauth_network" | "stk_network";
  networkKind: "timeout" | "network";
} {
  const name = error instanceof Error ? error.name : "";
  return {
    classification: stage === "oauth" ? "oauth_network" : "stk_network",
    networkKind: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network",
  };
}

type DarajaTelemetryEvent = {
  stage: DarajaTelemetryStage;
  event: "request_started" | "response" | "terminal_failure";
  environment?: "sandbox" | "production";
  classification?: DarajaFailureClassification;
  networkKind?: "timeout" | "network";
  httpStatus?: number;
  code?: string;
  message?: string;
  merchantRequestIdReturned?: boolean;
  checkoutRequestIdReturned?: boolean;
};

export function safeDarajaTelemetryEvent(event: DarajaTelemetryEvent): DarajaTelemetryEvent {
  return {
    stage: event.stage,
    event: event.event,
    ...(event.environment ? { environment: event.environment } : {}),
    ...(event.classification ? { classification: event.classification } : {}),
    ...(event.networkKind ? { networkKind: event.networkKind } : {}),
    ...(Number.isInteger(event.httpStatus) ? { httpStatus: event.httpStatus } : {}),
    ...(safeText(event.code, 80) ? { code: safeText(event.code, 80) } : {}),
    ...(safeText(event.message) ? { message: safeText(event.message) } : {}),
    ...(typeof event.merchantRequestIdReturned === "boolean" ? { merchantRequestIdReturned: event.merchantRequestIdReturned } : {}),
    ...(typeof event.checkoutRequestIdReturned === "boolean" ? { checkoutRequestIdReturned: event.checkoutRequestIdReturned } : {}),
  };
}

export function logDarajaTelemetry(event: DarajaTelemetryEvent): void {
  const line = JSON.stringify(safeDarajaTelemetryEvent(event));
  if (event.event === "terminal_failure") console.error("daraja_payment", line);
  else console.info("daraja_payment", line);
}
