import "server-only";

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
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Authentication required.");
  if (getDatabaseBackendName() === "postgres") return new PostgresAuthenticatedRpcDatabase(user.id);
  return new SupabaseAuthenticatedRpcDatabase(supabase);
}

export function getTrustedRpcDatabase(): TrustedRpcDatabase {
  if (getDatabaseBackendName() === "postgres") return new PostgresTrustedRpcDatabase();
  return new SupabaseTrustedRpcDatabase(createAdminClient());
}
