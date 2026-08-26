import "server-only";

import { UUID_PATTERN } from "../admin/validation.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server";
import { getUserRole, type UserRole } from "../auth/session.ts";
import type { ExamDocumentReadRepository, ExamReadRepository } from "./contracts.ts";
import { PostgresExamReadRepository } from "./postgres.ts";
import { SupabaseExamReadRepository } from "./supabase.ts";

export type { AuthorizedExamDocumentRow, ExamDocumentAccessMetadata, ExamDocumentReadRepository, ExamReadRepository, RecentTeacherExam, TeacherExamForEditing, TeacherExamListItem } from "./contracts.ts";

export function validExamId(id: string): boolean { return UUID_PATTERN.test(id); }

export async function getTeacherExamReadContext(): Promise<{ repository: ExamReadRepository; teacherId: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Authentication required.");
  const { data: teacher, error: teacherError } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (teacherError || !teacher) throw new Error("Teacher access required.");
  const repository = getDatabaseBackendName() === "postgres"
    ? new PostgresExamReadRepository(user.id, teacher.id)
    : new SupabaseExamReadRepository(supabase, teacher.id);
  return { repository, teacherId: teacher.id };
}

export async function getTeacherExamReadRepository(): Promise<ExamReadRepository> {
  return (await getTeacherExamReadContext()).repository;
}

export async function getExamDocumentReadContext(): Promise<{ repository: ExamDocumentReadRepository; role: UserRole | null }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Authentication required.");
  const role = await getUserRole();
  let teacherId: string | null = null;
  if (role === "teacher") {
    const { data: teacher, error: teacherError } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if (teacherError || !teacher) throw new Error("Teacher access required.");
    teacherId = teacher.id;
  }
  const repository = getDatabaseBackendName() === "postgres"
    ? new PostgresExamReadRepository(user.id, teacherId, role)
    : new SupabaseExamReadRepository(supabase, teacherId, role);
  return { repository, role };
}
