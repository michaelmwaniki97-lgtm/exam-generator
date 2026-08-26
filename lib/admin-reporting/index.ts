import "server-only";

import { isAdminRole } from "../auth/access.ts";
import { getCurrentUser, getUserRole } from "../auth/session.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server.ts";
import type { AdminReportingRepository } from "./contracts.ts";
import { PostgresAdminReportingRepository } from "./postgres.ts";
import { SupabaseAdminReportingRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getAdminReportingRepository(): Promise<AdminReportingRepository> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || !isAdminRole(role)) throw new Error("Administrator access is required.");
  if (getDatabaseBackendName() === "postgres") {
    return new PostgresAdminReportingRepository(user.id);
  }
  return new SupabaseAdminReportingRepository(await createClient());
}
