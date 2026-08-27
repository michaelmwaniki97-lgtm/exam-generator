import "server-only";

import { getCurrentAuthUser, requireSupabaseAuthForSupabaseDataApi } from "../auth-backend/index.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server";
import type { CurriculumReadRepository } from "./contracts.ts";
import { PostgresCurriculumReadRepository } from "./postgres.ts";
import { SupabaseCurriculumReadRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getCurriculumReadRepository(): Promise<CurriculumReadRepository> {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Authentication required.");
  const databaseBackend = getDatabaseBackendName();
  if (databaseBackend === "postgres") return new PostgresCurriculumReadRepository(user.id);
  requireSupabaseAuthForSupabaseDataApi(databaseBackend);
  return new SupabaseCurriculumReadRepository(await createClient());
}
