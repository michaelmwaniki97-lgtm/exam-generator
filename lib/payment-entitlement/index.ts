import "server-only";

import { getDatabaseBackendName } from "../db/config.ts";
import { getCurrentIdentityContext } from "../identity-read/index.ts";
import { createClient } from "../supabase/server.ts";
import type { PaymentEntitlementReadRepository } from "./contracts.ts";
import { PostgresPaymentEntitlementReadRepository } from "./postgres.ts";
import { SupabasePaymentEntitlementReadRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getPaymentEntitlementReadRepository(): Promise<PaymentEntitlementReadRepository> {
  const identity = await getCurrentIdentityContext();
  if (!identity || await identity.repository.resolveRole() !== "teacher") throw new Error("Teacher access is required.");
  const teacher = await identity.repository.getTeacherIdentity();
  if (!teacher) throw new Error("Teacher access is required.");
  return getDatabaseBackendName() === "postgres"
    ? new PostgresPaymentEntitlementReadRepository(identity.user.id, teacher.id)
    : new SupabasePaymentEntitlementReadRepository(await createClient(), teacher.id);
}
