export type AuthBackendName = "supabase" | "better-auth";

type Environment = Record<string, string | undefined>;

export function getAuthBackendName(
  environment: Environment = process.env,
): AuthBackendName {
  const configured = environment.AUTH_BACKEND?.trim().toLowerCase();
  if (!configured) {
    if (
      environment.NODE_ENV === "development"
      || environment.NEXT_PHASE === "phase-production-build"
    ) return "better-auth";
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "AUTH_BACKEND is required in production; use better-auth for the accepted self-hosted runtime or supabase only for an approved compatibility/rollback deployment.",
      );
    }
    // Preserve deterministic legacy behavior for isolated unit/maintenance
    // processes that do not declare a Next.js runtime environment.
    return "supabase";
  }
  if (configured === "supabase") return "supabase";
  if (configured === "better-auth") return "better-auth";
  throw new Error("AUTH_BACKEND must be either supabase or better-auth.");
}
