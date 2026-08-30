import "server-only";

import type { DatabaseBackendName } from "./contracts.ts";

type Environment = Record<string, string | undefined>;

export function getDatabaseBackendName(
  environment: Environment = process.env,
): DatabaseBackendName {
  const configured = environment.DATABASE_BACKEND?.trim().toLowerCase();
  if (!configured) {
    if (
      environment.NODE_ENV === "development"
      || environment.NEXT_PHASE === "phase-production-build"
    ) return "postgres";
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "DATABASE_BACKEND is required in production; use postgres for the accepted self-hosted runtime or supabase only for an approved compatibility/rollback deployment.",
      );
    }
    return "supabase";
  }
  if (configured === "supabase") return "supabase";
  if (configured === "postgres") return "postgres";
  throw new Error("DATABASE_BACKEND must be either supabase or postgres.");
}
