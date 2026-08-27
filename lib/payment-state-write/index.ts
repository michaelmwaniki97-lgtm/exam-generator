import "server-only";

import { getDatabaseBackendName } from "../db/config.ts";
import { createAdminClient } from "../supabase/admin.ts";
import type { PaymentStateWriteRepository } from "./contracts.ts";
import { PostgresPaymentStateWriteRepository } from "./postgres.ts";
import { SupabasePaymentStateWriteRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export function getPaymentStateWriteRepository(): PaymentStateWriteRepository {
  return getDatabaseBackendName() === "postgres"
    ? new PostgresPaymentStateWriteRepository()
    : new SupabasePaymentStateWriteRepository(createAdminClient());
}
