export type AuthCutoverState = "compatibility" | "rollback-window" | "accepted";

export function getAuthCutoverState(
  environment: Record<string, string | undefined> = process.env,
): AuthCutoverState {
  const configured = environment.AUTH_CUTOVER_STATE?.trim().toLowerCase();
  if (!configured || configured === "compatibility") return "compatibility";
  if (configured === "rollback-window") return "rollback-window";
  if (configured === "accepted") return "accepted";
  throw new Error("AUTH_CUTOVER_STATE must be compatibility, rollback-window, or accepted.");
}

function normalized(environment: Record<string, string | undefined>, name: string, fallback = ""): string {
  return (environment[name] ?? fallback).trim().toLowerCase();
}

/**
 * Validate only the cross-variable lifecycle contract. Environment details such
 * as URL/secret/SMTP/database readiness remain in the dedicated traffic checks.
 */
export function assertAuthCutoverConfiguration(
  environment: Record<string, string | undefined> = process.env,
): void {
  const state = getAuthCutoverState(environment);
  if (state === "compatibility") return;

  const authBackend = normalized(environment, "AUTH_BACKEND", "supabase");
  if (authBackend !== "supabase" && authBackend !== "better-auth") {
    throw new Error("AUTH_BACKEND must be either supabase or better-auth.");
  }
  if (state === "accepted" && authBackend !== "better-auth") {
    throw new Error("AUTH_BACKEND=better-auth is required after AUTH_CUTOVER_STATE=accepted.");
  }
  if (normalized(environment, "DATABASE_BACKEND", "supabase") !== "postgres") {
    throw new Error(`DATABASE_BACKEND=postgres is required while AUTH_CUTOVER_STATE=${state}.`);
  }

  const mutationMode = normalized(environment, "AUTH_MUTATION_MODE", "normal");
  if (state === "rollback-window" && mutationMode !== "cutover-freeze") {
    throw new Error("AUTH_MUTATION_MODE=cutover-freeze is required during AUTH_CUTOVER_STATE=rollback-window.");
  }
  if (state === "accepted" && mutationMode !== "normal") {
    throw new Error("AUTH_MUTATION_MODE=normal is required after AUTH_CUTOVER_STATE=accepted.");
  }
}

export function isAuthCutoverAccepted(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return getAuthCutoverState(environment) === "accepted";
}

/** Defense in depth for the retained legacy adapter during final repository cleanup. */
export function assertLegacySupabaseAuthAllowed(
  environment: Record<string, string | undefined> = process.env,
): void {
  if (isAuthCutoverAccepted(environment)) {
    throw new Error("Supabase Auth is retired after AUTH_CUTOVER_STATE=accepted.");
  }
}
