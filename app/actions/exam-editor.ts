"use server";

import { revalidatePath } from "next/cache";
import { UUID_PATTERN } from "@/lib/admin/validation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyEditableChanges, editableExamOrThrow, ExamEditorError, type EditableSlotInput, type StoredExamContent, type StoredMarkingContent } from "@/lib/exam-editor/core";
import { regenerateQuestion } from "@/lib/exam-editor/regenerate-question";
import { prepareRegenerationGrounding } from "@/lib/exam-editor/regeneration-grounding";
import type { GroundingProvenance } from "@/lib/textbooks/exam-grounding";

export type ExamEditorActionResult = { ok: true; revision: number } | { ok: false; error: string; stale?: boolean };
type CanonicalExam = { id: string; teacher_id: string; subject_id: string; grade_id: string; exam_type: string; difficulty: string; status: string; revision: number; content: StoredExamContent; marking_schemes: Array<{ content: StoredMarkingContent }> };

function diagnostic(stage: string, details: string) {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`[Exam Editor] stage=${stage} ${details.replace(/\s+/g, " ").slice(0, 500)}`);
}

function safeRpcFailure(error: { code?: string; message: string }): string {
  const known = ["stale_exam_revision", "exam_locked", "exam_not_editable", "marking_scheme_not_editable", "invalid_exam_update"];
  return known.find((message) => error.message.includes(message)) ?? "unexpected_database_error";
}

function regenerationDiagnostic(target: string, stage: string, result: "started" | "ok" | "failed") {
  if (process.env.NODE_ENV !== "development") return;
  const safeTarget = target.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 200) || "invalid";
  console.error(`[Exam Regeneration] target=${safeTarget} stage=${stage} result=${result}`);
}

async function authenticatedTeacher() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ExamEditorError("You must be signed in to edit an exam.");
  const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
  if (!teacher) throw new ExamEditorError("Only teachers can edit exams.");
  return teacher.id;
}

async function loadCanonical(examId: string, teacherId: string) {
  if (!UUID_PATTERN.test(examId)) throw new ExamEditorError("The requested exam is invalid.");
  const admin = createAdminClient();
  const { data, error } = await admin.from("exams").select("id, teacher_id, subject_id, grade_id, exam_type, difficulty, status, revision, content, marking_schemes(content)").eq("id", examId).maybeSingle();
  const exam = data as unknown as CanonicalExam | null;
  if (error || !exam || exam.teacher_id !== teacherId) throw new ExamEditorError("The requested exam was not found or does not belong to you.");
  if (exam.status === "paid" || exam.status === "downloaded") throw new ExamEditorError("Paid or downloaded exams are locked and cannot be edited.");
  if (!Number.isInteger(exam.revision) || exam.revision < 1) throw new ExamEditorError("This exam does not support safe concurrent editing.");
  if (exam.marking_schemes.length !== 1) throw new ExamEditorError("This exam does not have one compatible marking scheme.");
  editableExamOrThrow(exam.content, exam.marking_schemes[0].content);
  diagnostic("canonical_load", `result=ok revision=${exam.revision} schemes=${exam.marking_schemes.length}`);
  return { admin, exam, marking: exam.marking_schemes[0].content };
}

async function persist(admin: ReturnType<typeof createAdminClient>, exam: CanonicalExam, teacherId: string, expectedRevision: number, content: StoredExamContent, marking: StoredMarkingContent): Promise<ExamEditorActionResult> {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) return { ok: false, error: "The editor revision is invalid. Refresh and try again." };
  diagnostic("rpc_call", `revision=${expectedRevision}`);
  const { data, error } = await admin.rpc("update_exam_and_scheme_atomic", { p_exam_id: exam.id, p_teacher_id: teacherId, p_expected_revision: expectedRevision, p_exam_content: content, p_marking_content: marking });
  if (error) {
    diagnostic("rpc_failure", `code=${error.code || "unknown"} message=${safeRpcFailure(error)}`);
    if (error.message.includes("stale_exam_revision") || error.code === "40001") return { ok: false, stale: true, error: "This exam changed in another tab or session. Refresh the page before editing again." };
    if (error.message.includes("exam_locked")) return { ok: false, error: "This exam is locked and can no longer be edited." };
    return { ok: false, error: "The exam could not be saved. No changes were made." };
  }
  const revision = Number(data);
  if (!Number.isInteger(revision)) return { ok: false, error: "The exam was saved but its new revision could not be confirmed. Refresh before continuing." };
  diagnostic("rpc_success", `revision=${revision}`);
  revalidatePath(`/teacher/exams/${exam.id}`); revalidatePath(`/teacher/exams/${exam.id}/edit`); revalidatePath(`/teacher/exams/${exam.id}/marking-scheme`);
  return { ok: true, revision };
}

export async function saveExamEdits(examId: string, expectedRevision: number, inputs: EditableSlotInput[]): Promise<ExamEditorActionResult> {
  let stage = "authentication";
  try {
    const teacherId = await authenticatedTeacher();
    stage = "canonical_load";
    const { admin, exam, marking } = await loadCanonical(examId, teacherId);
    stage = "validation";
    const next = applyEditableChanges(exam.content, marking, inputs);
    diagnostic("merge", "result=ok");
    diagnostic("validation", "result=ok");
    stage = "rpc_call";
    return persist(admin, exam, teacherId, expectedRevision, next.exam, next.marking);
  } catch (error) {
    const reason = error instanceof ExamEditorError ? error.message : "unexpected_server_error";
    diagnostic(stage, `result=failed reason=${reason}`);
    return { ok: false, error: error instanceof ExamEditorError ? error.message : "The exam could not be saved. No changes were made." };
  }
}

export async function regenerateExamQuestion(examId: string, slotId: string, expectedRevision: number): Promise<ExamEditorActionResult> {
  let stage = "authentication";
  regenerationDiagnostic(slotId, stage, "started");
  try {
    if (!slotId || slotId.length > 200) throw new ExamEditorError("The requested question is invalid.");
    const teacherId = await authenticatedTeacher();
    stage = "canonical_load";
    const { admin, exam, marking } = await loadCanonical(examId, teacherId);
    regenerationDiagnostic(slotId, stage, "ok");
    const { blueprint } = editableExamOrThrow(exam.content, marking);
    stage = "target_contract";
    const slot = blueprint.questionSlots.find((item) => item.id === slotId);
    if (!slot) throw new ExamEditorError("The requested question does not belong to this exam.");
    regenerationDiagnostic(slotId, stage, "ok");
    const meta = exam.content.meta as StoredExamContent["meta"] & { subjectName?: string; gradeName?: string; textbookName?: string | null; textbookGrounding?: GroundingProvenance | null; questionGrounding?: Record<string, GroundingProvenance> };
    let textbookName: string | undefined; let textbookContext; let provenance: GroundingProvenance | undefined;
    stage = "grounding";
    if (meta.textbookGrounding) {
      const targets = blueprint.topicAllocations.filter((topic) => slot.curriculumTargetIds.includes(topic.curriculumId));
      const grounding = await prepareRegenerationGrounding({ provenance: meta.textbookGrounding, subjectId: exam.subject_id, gradeId: exam.grade_id, subjectName: meta.subjectName ?? blueprint.subjectName, gradeName: meta.gradeName ?? blueprint.gradeName, curriculumIds: slot.curriculumTargetIds, topics: targets.map((topic) => ({ strandName: topic.parentName, subStrandName: topic.displayName, outcomes: [] })) });
      textbookName = grounding.textbookName; textbookContext = grounding.context; provenance = grounding.provenance;
    }
    regenerationDiagnostic(slotId, stage, "ok");
    stage = "generation";
    const regenerated = await regenerateQuestion({ exam: exam.content, marking, blueprint, slotId, subjectName: meta.subjectName ?? blueprint.subjectName, gradeName: meta.gradeName ?? blueprint.gradeName, examType: exam.exam_type, difficulty: exam.difficulty, textbookName, textbookContext });
    regenerationDiagnostic(slotId, stage, "ok");
    const nextExam = provenance ? { ...regenerated.exam, meta: { ...regenerated.exam.meta, questionGrounding: { ...(meta.questionGrounding ?? {}), [slotId]: provenance } } } : regenerated.exam;
    stage = "rpc_call";
    const result = await persist(admin, exam, teacherId, expectedRevision, nextExam, regenerated.marking);
    regenerationDiagnostic(slotId, stage, result.ok ? "ok" : "failed");
    return result;
  } catch (error) {
    regenerationDiagnostic(slotId, stage, "failed");
    return { ok: false, error: error instanceof ExamEditorError ? error.message : "Question regeneration failed. The original question and marking scheme were preserved." };
  }
}
