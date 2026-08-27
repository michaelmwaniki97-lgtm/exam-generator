import "server-only";

import { isAdminRole } from "../auth/access.ts";
import { getCurrentUser, getUserRole } from "../auth/session.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server.ts";
import type { CatalogWriteRepository } from "./contracts.ts";
import { PostgresCatalogWriteRepository } from "./postgres.ts";
import { SupabaseCatalogWriteRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getCatalogWriteRepository(): Promise<CatalogWriteRepository> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || !isAdminRole(role)) throw new Error("Administrator access is required.");
  if (getDatabaseBackendName() === "postgres") return new PostgresCatalogWriteRepository(user.id);
  return new SupabaseCatalogWriteRepository(await createClient());
}
