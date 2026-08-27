import "server-only";

import { getAuthBackendName, getCurrentAuthUser, requireSupabaseAuthForSupabaseDataApi, type AuthenticatedUser } from "../auth-backend/index.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server.ts";
import type { IdentityReadRepository } from "./contracts.ts";
import { PostgresIdentityReadRepository } from "./postgres.ts";
import { SupabaseIdentityReadRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getIdentityReadRepositoryForAuthenticatedUser(
  user: AuthenticatedUser,
): Promise<IdentityReadRepository> {
  const databaseBackend = getDatabaseBackendName();
  if (databaseBackend === "postgres") {
    return new PostgresIdentityReadRepository(user.id);
  }

  requireSupabaseAuthForSupabaseDataApi(databaseBackend);
  if (getAuthBackendName() !== "supabase") {
    throw new Error("Supabase Data API access requires a Supabase-authenticated session.");
  }
  const supabase = await createClient();
  return new SupabaseIdentityReadRepository(supabase, user.id);
}

export async function getCurrentIdentityContext(): Promise<{
  user: AuthenticatedUser;
  repository: IdentityReadRepository;
} | null> {
  const user = await getCurrentAuthUser();
  if (!user) return null;
  return { user, repository: await getIdentityReadRepositoryForAuthenticatedUser(user) };
}

export async function getIdentityReadRepository(): Promise<IdentityReadRepository> {
  const context = await getCurrentIdentityContext();
  if (!context) throw new Error("Authentication required.");
  return context.repository;
}
