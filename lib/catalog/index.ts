import "server-only";

import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server";
import type { CatalogRepository } from "./contracts.ts";
import { PostgresCatalogRepository } from "./postgres.ts";
import { SupabaseCatalogRepository } from "./supabase.ts";

export type { CatalogOptionRow, CatalogRepository, GradeRow, WizardGradeRow } from "./contracts.ts";

export async function getCatalogRepository(): Promise<CatalogRepository> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Authentication required.");
  if (getDatabaseBackendName() === "postgres") return new PostgresCatalogRepository(user.id);
  return new SupabaseCatalogRepository(supabase);
}
