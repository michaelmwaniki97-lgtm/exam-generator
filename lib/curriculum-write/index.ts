import "server-only";

import { isAdminRole } from "../auth/access.ts";
import { getCurrentUser, getUserRole } from "../auth/session.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server.ts";
import type { CurriculumWriteRepository } from "./contracts.ts";
import { PostgresCurriculumWriteRepository } from "./postgres.ts";
import { SupabaseCurriculumWriteRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getCurriculumWriteRepository(): Promise<CurriculumWriteRepository> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || !isAdminRole(role)) throw new Error("Administrator access is required.");
  if (getDatabaseBackendName() === "postgres") {
    return new PostgresCurriculumWriteRepository(user.id);
  }
  return new SupabaseCurriculumWriteRepository(await createClient());
}
