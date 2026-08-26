import "server-only";

import { getDatabaseBackendName } from "../db/config.ts";
import { createAdminClient } from "../supabase/admin.ts";
import type { AppSettingsReadRepository } from "./contracts.ts";
import { PostgresAppSettingsReadRepository } from "./postgres.ts";
import { SupabaseAppSettingsReadRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export function getAppSettingsReadRepository(): AppSettingsReadRepository {
  return getDatabaseBackendName() === "postgres"
    ? new PostgresAppSettingsReadRepository()
    : new SupabaseAppSettingsReadRepository(createAdminClient());
}
