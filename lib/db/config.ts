import "server-only";

import type { DatabaseBackendName } from "./contracts.ts";

export function getDatabaseBackendName(): DatabaseBackendName {
  const configured = process.env.DATABASE_BACKEND?.trim().toLowerCase();
  if (!configured || configured === "supabase") return "supabase";
  if (configured === "postgres") return "postgres";
  throw new Error("DATABASE_BACKEND must be either supabase or postgres.");
}
