import "server-only";

import { getCurrentAuthUser, requireSupabaseAuthForSupabaseDataApi } from "../auth-backend/index.ts";
import { createAdminClient } from "../supabase/admin";
import { createClient } from "../supabase/server";
import { getDatabaseBackendName } from "./config.ts";
import type { AuthenticatedRpcDatabase, TrustedRpcDatabase } from "./contracts.ts";
import { PostgresAuthenticatedRpcDatabase, PostgresTrustedRpcDatabase } from "./postgres-rpc.ts";
import { SupabaseAuthenticatedRpcDatabase, SupabaseTrustedRpcDatabase } from "./supabase-rpc.ts";

export { DatabaseRpcError } from "./contracts.ts";
export { getDatabaseBackendName } from "./config.ts";
export type { AuthenticatedRpcDatabase, TrustedRpcDatabase } from "./contracts.ts";

export async function getAuthenticatedRpcDatabase(): Promise<AuthenticatedRpcDatabase> {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Authentication required.");
  const databaseBackend = getDatabaseBackendName();
  if (databaseBackend === "postgres") return new PostgresAuthenticatedRpcDatabase(user.id);
  requireSupabaseAuthForSupabaseDataApi(databaseBackend);
  return new SupabaseAuthenticatedRpcDatabase(await createClient());
}

export function getTrustedRpcDatabase(): TrustedRpcDatabase {
  if (getDatabaseBackendName() === "postgres") return new PostgresTrustedRpcDatabase();
  return new SupabaseTrustedRpcDatabase(createAdminClient());
}
