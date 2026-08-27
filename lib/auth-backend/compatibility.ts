import "server-only";

import { getAuthBackendName } from "./config.ts";

export function requireSupabaseAuthForSupabaseDataApi(databaseBackend: "supabase" | "postgres"): void {
  if (databaseBackend === "supabase" && getAuthBackendName() === "better-auth") {
    throw new Error(
      "Better Auth sessions require DATABASE_BACKEND=postgres for protected database access during auth migration.",
    );
  }
}
