import "server-only";

import { getCurrentIdentityContext } from "../identity-read/index.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createAdminClient } from "../supabase/admin.ts";
import type { AdminTextbookReadRepository, TeacherTextbookReadRepository } from "./contracts.ts";
import { PostgresTextbookReadRepository } from "./postgres.ts";
import { SupabaseTextbookReadRepository } from "./supabase.ts";

export type * from "./contracts.ts";
export { hasDuplicateTextbookName } from "./contracts.ts";

async function context(requiredRole: "admin" | "teacher") {
  const identity = await getCurrentIdentityContext();
  if (!identity || await identity.repository.resolveRole() !== requiredRole) {
    throw new Error(requiredRole === "admin" ? "Administrator access is required." : "Teacher access is required.");
  }
  return identity.user.id;
}

export async function getAdminTextbookReadRepository(): Promise<AdminTextbookReadRepository> {
  const userId = await context("admin");
  return getDatabaseBackendName() === "postgres"
    ? new PostgresTextbookReadRepository(userId, "admin")
    : new SupabaseTextbookReadRepository(createAdminClient());
}

export async function getTeacherTextbookReadRepository(): Promise<TeacherTextbookReadRepository> {
  const userId = await context("teacher");
  return getDatabaseBackendName() === "postgres"
    ? new PostgresTextbookReadRepository(userId, "teacher")
    : new SupabaseTextbookReadRepository(createAdminClient());
}
