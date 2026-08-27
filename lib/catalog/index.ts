import "server-only";

import { getCurrentAuthUser, requireSupabaseAuthForSupabaseDataApi } from "../auth-backend/index.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server";
import type { CatalogRepository } from "./contracts.ts";
import { PostgresCatalogRepository } from "./postgres.ts";
import { SupabaseCatalogRepository } from "./supabase.ts";

export type { CatalogOptionRow, CatalogRepository, GradeRow, WizardGradeRow } from "./contracts.ts";

export async function getCatalogRepository(): Promise<CatalogRepository> {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Authentication required.");
  const databaseBackend = getDatabaseBackendName();
  if (databaseBackend === "postgres") return new PostgresCatalogRepository(user.id);
  requireSupabaseAuthForSupabaseDataApi(databaseBackend);
  return new SupabaseCatalogRepository(await createClient());
}
