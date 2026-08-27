import "server-only";
import { getCurrentIdentityContext } from "../identity-read/index.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createAdminClient } from "../supabase/admin.ts";
import type { TextbookWorkflowRepository } from "./contracts.ts";
import { PostgresTextbookWorkflowRepository } from "./postgres.ts";
import { SupabaseTextbookWorkflowRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getTextbookWorkflowRepository(): Promise<TextbookWorkflowRepository> {
  const identity = await getCurrentIdentityContext();
  if (!identity || await identity.repository.resolveRole() !== "admin") throw new Error("Administrator access is required.");
  return getDatabaseBackendName() === "postgres"
    ? new PostgresTextbookWorkflowRepository()
    : new SupabaseTextbookWorkflowRepository(createAdminClient());
}
