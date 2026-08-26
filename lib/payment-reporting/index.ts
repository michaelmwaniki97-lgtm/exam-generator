import "server-only";

import { getCurrentIdentityContext } from "../identity-read/index.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createAdminClient } from "../supabase/admin.ts";
import { createClient } from "../supabase/server.ts";
import type { AdminPaymentReportingRepository, TeacherPaymentReportingRepository } from "./contracts.ts";
import { PostgresAdminPaymentReportingRepository, PostgresTeacherPaymentReportingRepository } from "./postgres.ts";
import { SupabaseAdminPaymentReportingRepository, SupabaseTeacherPaymentReportingRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export async function getTeacherPaymentReportingRepository(): Promise<TeacherPaymentReportingRepository> {
  const identity = await getCurrentIdentityContext();
  if (!identity || await identity.repository.resolveRole() !== "teacher") throw new Error("Teacher access is required.");
  const teacher = await identity.repository.getTeacherIdentity();
  if (!teacher) throw new Error("Teacher access is required.");
  return getDatabaseBackendName() === "postgres"
    ? new PostgresTeacherPaymentReportingRepository(identity.user.id, teacher.id)
    : new SupabaseTeacherPaymentReportingRepository(createAdminClient(), teacher.id);
}

export async function getAdminPaymentReportingRepository(): Promise<AdminPaymentReportingRepository> {
  const identity = await getCurrentIdentityContext();
  if (!identity || await identity.repository.resolveRole() !== "admin") throw new Error("Administrator access is required.");
  return getDatabaseBackendName() === "postgres"
    ? new PostgresAdminPaymentReportingRepository(identity.user.id)
    : new SupabaseAdminPaymentReportingRepository(await createClient());
}
