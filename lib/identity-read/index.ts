import "server-only";

import type { User } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server.ts";
import type { IdentityReadRepository } from "./contracts.ts";
import { PostgresIdentityReadRepository } from "./postgres.ts";
import { SupabaseIdentityReadRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getCurrentIdentityContext(): Promise<{
  user: User;
  repository: IdentityReadRepository;
} | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const repository = getDatabaseBackendName() === "postgres"
    ? new PostgresIdentityReadRepository(user.id)
    : new SupabaseIdentityReadRepository(supabase, user.id);
  return { user, repository };
}

export async function getIdentityReadRepository(): Promise<IdentityReadRepository> {
  const context = await getCurrentIdentityContext();
  if (!context) throw new Error("Authentication required.");
  return context.repository;
}
