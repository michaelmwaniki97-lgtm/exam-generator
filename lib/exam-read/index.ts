import "server-only";

import { UUID_PATTERN } from "../admin/validation.ts";
import { getCurrentAuthUser, requireSupabaseAuthForSupabaseDataApi } from "../auth-backend/index.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createAdminClient } from "../supabase/admin.ts";
import { createClient } from "../supabase/server";
import { getUserRole, type UserRole } from "../auth/session.ts";
import type { ExamDocumentReadRepository, ExamReadRepository, TrustedExamReadRepository } from "./contracts.ts";
import { PostgresExamReadRepository, PostgresTrustedExamReadRepository } from "./postgres.ts";
import { SupabaseExamReadRepository, SupabaseTrustedExamReadRepository } from "./supabase.ts";
import { getIdentityReadRepository } from "../identity-read/index.ts";

export type { AuthorizedExamDocumentRow, ExamDocumentAccessMetadata, ExamDocumentReadRepository, ExamReadRepository, RecentTeacherExam, TeacherExamForEditing, TeacherExamListItem, TeacherExamPaymentMetadata, TrustedExamReadRepository } from "./contracts.ts";

export function validExamId(id: string): boolean { return UUID_PATTERN.test(id); }

async function authenticatedSupabaseFallback() {
  const databaseBackend = getDatabaseBackendName();
  requireSupabaseAuthForSupabaseDataApi(databaseBackend);
  return createClient();
}

export async function getTeacherExamReadContext(): Promise<{ repository: ExamReadRepository; teacherId: string }> {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Authentication required.");
  const teacher = await (await getIdentityReadRepository()).getTeacherIdentity();
  if (!teacher) throw new Error("Teacher access required.");
  const repository = getDatabaseBackendName() === "postgres"
    ? new PostgresExamReadRepository(user.id, teacher.id)
    : new SupabaseExamReadRepository(await authenticatedSupabaseFallback(), teacher.id);
  return { repository, teacherId: teacher.id };
}

export async function getTeacherExamReadRepository(): Promise<ExamReadRepository> {
  return (await getTeacherExamReadContext()).repository;
}

export function getTrustedExamReadRepository(): TrustedExamReadRepository {
  return getDatabaseBackendName() === "postgres"
    ? new PostgresTrustedExamReadRepository()
    : new SupabaseTrustedExamReadRepository(createAdminClient());
}

export async function getExamDocumentReadContext(): Promise<{ repository: ExamDocumentReadRepository; role: UserRole | null }> {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Authentication required.");
  const role = await getUserRole();
  if (role !== "teacher" && role !== "admin") throw new Error("Access denied.");
  let teacherId: string | null = null;
  if (role === "teacher") {
    const teacher = await (await getIdentityReadRepository()).getTeacherIdentity();
    if (!teacher) throw new Error("Teacher access required.");
    teacherId = teacher.id;
  }
  const repository = getDatabaseBackendName() === "postgres"
    ? new PostgresExamReadRepository(user.id, teacherId, role)
    : new SupabaseExamReadRepository(await authenticatedSupabaseFallback(), teacherId, role);
  return { repository, role };
}
