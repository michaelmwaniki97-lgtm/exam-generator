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

export type SafeOAuthShapeFields = {
  responseIsJson: boolean;
  topLevelJsonKeys: string[];
  accessTokenPresent: boolean;
  accessTokenType: string;
  accessTokenNonempty: boolean;
  expiresInPresent: boolean;
  expiresInType: string;
  expiresInSafeValue?: string;
  expiresInParseableInteger: boolean;
  failedConditions: string[];
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

export function safeDarajaOAuthShapeFields(value: unknown): SafeOAuthShapeFields {
  const isObject = Boolean(value && typeof value === "object" && !Array.isArray(value));
  const response = isObject ? value as Record<string, unknown> : {};
  const tokenPresent = Object.prototype.hasOwnProperty.call(response, "access_token");
  const expiresPresent = Object.prototype.hasOwnProperty.call(response, "expires_in");
  const token = response.access_token;
  const expires = response.expires_in;
  const tokenString = typeof token === "string";
  const tokenNonempty = tokenString && token.length > 0;
  const tokenWithinLimit = tokenString && token.length <= 4096;
  const tokenWithoutControls = tokenString && !/[\u0000-\u001f\u007f]/.test(token);
  const expiresNumber = typeof expires === "number";
  const expiresString = typeof expires === "string";
  const expiresDigits = expiresString && /^\d+$/.test(expires);
  const normalizedExpires = expiresNumber ? expires : expiresDigits ? Number(expires) : NaN;
  const expiresSafeInteger = Number.isSafeInteger(normalizedExpires);
  const parseableInteger = expiresSafeInteger;
  const safeExpires = expiresSafeInteger && normalizedExpires >= 0 ? String(expires) : expiresDigits ? expires : undefined;
  const failedConditions = [
    ...(!tokenPresent ? ["access_token_missing"] : []),
    ...(tokenPresent && !tokenString ? ["access_token_not_string"] : []),
    ...(tokenString && !tokenNonempty ? ["access_token_empty"] : []),
    ...(tokenString && !tokenWithinLimit ? ["access_token_too_long"] : []),
    ...(tokenString && !tokenWithoutControls ? ["access_token_has_control_characters"] : []),
    ...(!expiresPresent ? ["expires_in_missing"] : []),
    ...(expiresPresent && !expiresNumber && !expiresDigits ? ["expires_in_invalid_format"] : []),
    ...((expiresNumber || expiresDigits) && !expiresSafeInteger ? ["expires_in_not_safe_integer"] : []),
    ...(expiresSafeInteger && normalizedExpires < 60 ? ["expires_in_below_minimum"] : []),
    ...(expiresSafeInteger && normalizedExpires > 86_400 ? ["expires_in_above_maximum"] : []),
  ];
  return {
    responseIsJson: true,
    topLevelJsonKeys: isObject ? Object.keys(response).filter((key) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)).slice(0, 32).sort() : [],
    accessTokenPresent: tokenPresent,
    accessTokenType: typeof token,
    accessTokenNonempty: tokenNonempty,
    expiresInPresent: expiresPresent,
    expiresInType: typeof expires,
    ...(safeExpires !== undefined ? { expiresInSafeValue: safeExpires } : {}),
    expiresInParseableInteger: parseableInteger,
    failedConditions,
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
  responseIsJson?: boolean;
  topLevelJsonKeys?: string[];
  accessTokenPresent?: boolean;
  accessTokenType?: string;
  accessTokenNonempty?: boolean;
  expiresInPresent?: boolean;
  expiresInType?: string;
  expiresInSafeValue?: string;
  expiresInParseableInteger?: boolean;
  failedConditions?: string[];
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
    ...(typeof event.responseIsJson === "boolean" ? { responseIsJson: event.responseIsJson } : {}),
    ...(Array.isArray(event.topLevelJsonKeys) ? { topLevelJsonKeys: event.topLevelJsonKeys.filter((key) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)).slice(0, 32) } : {}),
    ...(typeof event.accessTokenPresent === "boolean" ? { accessTokenPresent: event.accessTokenPresent } : {}),
    ...(event.accessTokenType ? { accessTokenType: safeText(event.accessTokenType, 16) } : {}),
    ...(typeof event.accessTokenNonempty === "boolean" ? { accessTokenNonempty: event.accessTokenNonempty } : {}),
    ...(typeof event.expiresInPresent === "boolean" ? { expiresInPresent: event.expiresInPresent } : {}),
    ...(event.expiresInType ? { expiresInType: safeText(event.expiresInType, 16) } : {}),
    ...(typeof event.expiresInSafeValue === "string" && /^\d{1,10}$/.test(event.expiresInSafeValue) ? { expiresInSafeValue: event.expiresInSafeValue } : {}),
    ...(typeof event.expiresInParseableInteger === "boolean" ? { expiresInParseableInteger: event.expiresInParseableInteger } : {}),
    ...(Array.isArray(event.failedConditions) ? { failedConditions: event.failedConditions.filter((condition) => /^[a-z_]{1,64}$/.test(condition)).slice(0, 16) } : {}),
  };
}

export function logDarajaTelemetry(event: DarajaTelemetryEvent): void {
  const line = JSON.stringify(safeDarajaTelemetryEvent(event));
  if (event.event === "terminal_failure") console.error("daraja_payment", line);
  else console.info("daraja_payment", line);
}
