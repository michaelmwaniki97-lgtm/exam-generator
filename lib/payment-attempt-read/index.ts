import "server-only";

import { getDatabaseBackendName } from "../db/config.ts";
import { createAdminClient } from "../supabase/admin.ts";
import type { PaymentAttemptReadRepository } from "./contracts.ts";
import { PostgresPaymentAttemptReadRepository } from "./postgres.ts";
import { SupabasePaymentAttemptReadRepository } from "./supabase.ts";

export type * from "./contracts.ts";
export { normalizePaymentAttempt } from "./contracts.ts";

export function getPaymentAttemptReadRepository(): PaymentAttemptReadRepository {
  return getDatabaseBackendName() === "postgres"
    ? new PostgresPaymentAttemptReadRepository()
    : new SupabasePaymentAttemptReadRepository(createAdminClient());
}
