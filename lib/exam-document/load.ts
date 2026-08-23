import "server-only";
import { createClient } from "../supabase/server";
import { getCurrentUser, getUserRole } from "../auth/session";
import { buildExamDocument, type ExamDocumentKind } from "./model";
import { mayAccessExam } from "./access";

export class ExamDocumentAccessError extends Error { constructor(public status: 401 | 403 | 404 | 422, message: string) { super(message); } }

export async function loadCanonicalExamDocument(id: string, kind: ExamDocumentKind) {
  const user = await getCurrentUser(); if (!user) throw new ExamDocumentAccessError(401, "Authentication required.");
  const role = await getUserRole(); const supabase = await createClient();
  const { data: teacher } = role === "teacher" ? await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle() : { data: null };
  const { data: exam } = await supabase.from("exams").select("id, teacher_id, exam_type, marks, duration, term, year, content, teachers(school), marking_schemes(content)").eq("id", id).maybeSingle();
  if (!exam) throw new ExamDocumentAccessError(404, "Exam not found.");
  if (!mayAccessExam(role, teacher?.id ?? null, exam.teacher_id)) throw new ExamDocumentAccessError(403, "You do not have access to this exam.");
  const teacherRow = exam.teachers as unknown as { school: string | null } | null;
  const schemes = exam.marking_schemes as unknown as Array<{ content: unknown }>;
  if (kind === "marking" && schemes?.length !== 1) throw new ExamDocumentAccessError(422, "This exam does not have one compatible marking scheme.");
  try {
    return buildExamDocument({ id: exam.id, examType: exam.exam_type, marks: exam.marks, duration: exam.duration, term: exam.term, year: exam.year, school: teacherRow?.school ?? null, content: exam.content, markingContent: schemes?.[0]?.content }, kind);
  } catch { throw new ExamDocumentAccessError(422, "This exam contains unsupported or invalid stored content and cannot be rendered safely."); }
}
