export type AuthMutationMode = "normal" | "cutover-freeze";

export const AUTH_CUTOVER_FROZEN_MESSAGE =
  "Account changes are temporarily paused while we complete authentication maintenance. Existing users can still log in.";

export function getAuthMutationMode(
  environment: Record<string, string | undefined> = process.env,
): AuthMutationMode {
  const configured = environment.AUTH_MUTATION_MODE?.trim().toLowerCase();
  if (!configured || configured === "normal") return "normal";
  if (configured === "cutover-freeze") return "cutover-freeze";
  throw new Error("AUTH_MUTATION_MODE must be either normal or cutover-freeze.");
}

export function isAuthMutationFrozen(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return getAuthMutationMode(environment) === "cutover-freeze";
}

export function assertAuthRollbackWindowFrozen(
  environment: Record<string, string | undefined> = process.env,
): void {
  if (!isAuthMutationFrozen(environment)) {
    throw new Error("AUTH_MUTATION_MODE=cutover-freeze is required for the auth rollback acceptance window.");
  }
}

const FROZEN_HTTP_ALLOWLIST = new Set([
  "GET /api/auth/get-session",
  "POST /api/auth/sign-in/email",
  "POST /api/auth/sign-out",
]);

export function isBetterAuthHttpRequestAllowedDuringFreeze(request: Request): boolean {
  const url = new URL(request.url);
  return FROZEN_HTTP_ALLOWLIST.has(`${request.method.toUpperCase()} ${url.pathname}`);
}
