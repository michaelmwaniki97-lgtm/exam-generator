import "server-only";

import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server";
import type { CurriculumReadRepository } from "./contracts.ts";
import { PostgresCurriculumReadRepository } from "./postgres.ts";
import { SupabaseCurriculumReadRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getCurriculumReadRepository(): Promise<CurriculumReadRepository> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Authentication required.");
  if (getDatabaseBackendName() === "postgres") return new PostgresCurriculumReadRepository(user.id);
  return new SupabaseCurriculumReadRepository(supabase);
}
