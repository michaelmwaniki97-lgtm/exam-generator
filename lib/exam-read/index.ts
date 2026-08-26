import "server-only";

import { UUID_PATTERN } from "../admin/validation.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server";
import type { ExamReadRepository } from "./contracts.ts";
import { PostgresExamReadRepository } from "./postgres.ts";
import { SupabaseExamReadRepository } from "./supabase.ts";

export type { ExamReadRepository, RecentTeacherExam, TeacherExamForEditing, TeacherExamListItem } from "./contracts.ts";

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
