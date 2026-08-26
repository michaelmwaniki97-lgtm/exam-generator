import "server-only";

import { UUID_PATTERN } from "../admin/validation.ts";
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

export async function getTeacherExamReadContext(): Promise<{ repository: ExamReadRepository; teacherId: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Authentication required.");
  const teacher = await (await getIdentityReadRepository()).getTeacherIdentity();
  if (!teacher) throw new Error("Teacher access required.");
  const repository = getDatabaseBackendName() === "postgres"
    ? new PostgresExamReadRepository(user.id, teacher.id)
    : new SupabaseExamReadRepository(supabase, teacher.id);
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
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Authentication required.");
  const role = await getUserRole();
  let teacherId: string | null = null;
  if (role === "teacher") {
    const teacher = await (await getIdentityReadRepository()).getTeacherIdentity();
    if (!teacher) throw new Error("Teacher access required.");
    teacherId = teacher.id;
  }
  const repository = getDatabaseBackendName() === "postgres"
    ? new PostgresExamReadRepository(user.id, teacherId, role)
    : new SupabaseExamReadRepository(supabase, teacherId, role);
  return { repository, role };
}
