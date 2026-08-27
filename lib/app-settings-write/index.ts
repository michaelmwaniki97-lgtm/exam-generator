import "server-only";

import { isAdminRole } from "../auth/access.ts";
import { getCurrentUser, getUserRole } from "../auth/session.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server.ts";
import type { AppSettingsWriteRepository } from "./contracts.ts";
import { PostgresAppSettingsWriteRepository } from "./postgres.ts";
import { SupabaseAppSettingsWriteRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getAppSettingsWriteRepository(): Promise<AppSettingsWriteRepository> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || !isAdminRole(role)) throw new Error("Administrator access is required.");
  return getDatabaseBackendName() === "postgres"
    ? new PostgresAppSettingsWriteRepository(user.id)
    : new SupabaseAppSettingsWriteRepository(await createClient());
}
