"use server";

import { revalidatePath } from "next/cache";
import { UUID_PATTERN } from "@/lib/admin/validation";
import { DatabaseRpcError, getTrustedRpcDatabase } from "@/lib/db";
import { getTeacherExamReadContext } from "@/lib/exam-read";
import { applyEditableChanges, editableExamOrThrow, ExamEditorError, type EditableSlotInput, type StoredExamContent, type StoredMarkingContent } from "@/lib/exam-editor/core";
import { regenerateQuestion } from "@/lib/exam-editor/regenerate-question";
import { prepareRegenerationGrounding } from "@/lib/exam-editor/regeneration-grounding";
import type { GroundingProvenance } from "@/lib/textbooks/exam-grounding";
import { acquiredOrThrow, claimQuestionRegeneration, failAiReservation, persistRegeneratedQuestion } from "@/lib/ai/abuse-controls";
import { AiAbuseControlError } from "@/lib/ai/abuse-controls-core";

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

async function loadCanonical(examId: string) {
  if (!UUID_PATTERN.test(examId)) throw new ExamEditorError("The requested exam is invalid.");
  let context;
  try { context = await getTeacherExamReadContext(); }
  catch { throw new ExamEditorError("You must be signed in as a teacher to edit an exam."); }
  const exam = await context.repository.getTeacherExamForEditing(examId) as CanonicalExam | null;
  if (!exam) throw new ExamEditorError("The requested exam was not found or does not belong to you.");
  if (exam.status === "paid" || exam.status === "downloaded") throw new ExamEditorError("Paid or downloaded exams are locked and cannot be edited.");
  if (!Number.isInteger(exam.revision) || exam.revision < 1) throw new ExamEditorError("This exam does not support safe concurrent editing.");
  if (exam.marking_schemes.length !== 1) throw new ExamEditorError("This exam does not have one compatible marking scheme.");
  editableExamOrThrow(exam.content, exam.marking_schemes[0].content);
  diagnostic("canonical_load", `result=ok revision=${exam.revision} schemes=${exam.marking_schemes.length}`);
  return { exam, marking: exam.marking_schemes[0].content, teacherId: context.teacherId };
}

async function persist(exam: CanonicalExam, teacherId: string, expectedRevision: number, content: StoredExamContent, marking: StoredMarkingContent): Promise<ExamEditorActionResult> {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) return { ok: false, error: "The editor revision is invalid. Refresh and try again." };
  diagnostic("rpc_call", `revision=${expectedRevision}`);
  let data: number;
  try {
    data = await getTrustedRpcDatabase().updateExamAndSchemeAtomic({ examId: exam.id, teacherId, expectedRevision, examContent: content, markingContent: marking });
  } catch (error) {
    const rpcError = error instanceof DatabaseRpcError || error instanceof Error ? error : new Error("unexpected_database_error");
    diagnostic("rpc_failure", `code=${error instanceof DatabaseRpcError ? error.code || "unknown" : "unknown"} message=${safeRpcFailure(rpcError)}`);
    if (rpcError.message.includes("stale_exam_revision") || (error instanceof DatabaseRpcError && error.code === "40001")) return { ok: false, stale: true, error: "This exam changed in another tab or session. Refresh the page before editing again." };
    if (rpcError.message.includes("exam_locked")) return { ok: false, error: "This exam is locked and can no longer be edited." };
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
    stage = "canonical_load";
    const { exam, marking, teacherId } = await loadCanonical(examId);
    stage = "validation";
    const next = applyEditableChanges(exam.content, marking, inputs);
    diagnostic("merge", "result=ok");
    diagnostic("validation", "result=ok");
    stage = "rpc_call";
    return persist(exam, teacherId, expectedRevision, next.exam, next.marking);
  } catch (error) {
    const reason = error instanceof ExamEditorError ? error.message : "unexpected_server_error";
    diagnostic(stage, `result=failed reason=${reason}`);
    return { ok: false, error: error instanceof ExamEditorError ? error.message : "The exam could not be saved. No changes were made." };
  }
}

export async function regenerateExamQuestion(examId: string, slotId: string, expectedRevision: number, requestId: string, mode: "question" | "visual" = "question"): Promise<ExamEditorActionResult> {
  let stage = "authentication";
  regenerationDiagnostic(slotId, stage, "started");
  try {
    if (mode !== "question" && mode !== "visual") throw new ExamEditorError("Invalid regeneration mode.");
    if (!slotId || slotId.length > 200) throw new ExamEditorError("The requested question is invalid.");
    stage = "canonical_load";
    const { exam, marking, teacherId } = await loadCanonical(examId);
    regenerationDiagnostic(slotId, stage, "ok");
    const { blueprint } = editableExamOrThrow(exam.content, marking);
    stage = "target_contract";
    const slot = blueprint.questionSlots.find((item) => item.id === slotId);
    if (!slot) throw new ExamEditorError("The requested question does not belong to this exam.");
    if (mode === "visual" && !exam.content.sections.flatMap(section => section.questions).find(question => question.slotId === slotId)?.visual) throw new ExamEditorError("This question has no visual to regenerate.");
    regenerationDiagnostic(slotId, stage, "ok");
    stage = "reservation";
    const reservationClaim = await claimQuestionRegeneration({ teacherId, examId, slotId, requestId, expectedRevision });
    if (reservationClaim.outcome === "stale") {
      return { ok: false, stale: true, error: "This exam changed in another tab or session. Refresh the page before regenerating." };
    }
    const claim = acquiredOrThrow(reservationClaim, "regeneration");
    if (claim.outcome === "completed" && claim.operation === "regeneration") {
      return { ok: true, revision: claim.resultRevision };
    }
    const reservationId = claim.reservationId;
    let reservationClosed = false;
    try {
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
    const regenerated = await regenerateQuestion({ mode, exam: exam.content, marking, blueprint, slotId, subjectName: meta.subjectName ?? blueprint.subjectName, gradeName: meta.gradeName ?? blueprint.gradeName, examType: exam.exam_type, difficulty: exam.difficulty, textbookName, textbookContext });
    regenerationDiagnostic(slotId, stage, "ok");
    const nextExam = provenance ? { ...regenerated.exam, meta: { ...regenerated.exam.meta, questionGrounding: { ...(meta.questionGrounding ?? {}), [slotId]: provenance } } } : regenerated.exam;
    stage = "rpc_call";
    const revision = await persistRegeneratedQuestion({ teacherId, reservationId, requestId, examId, slotId, expectedRevision, examContent: nextExam, markingContent: regenerated.marking });
    reservationClosed = true;
    revalidatePath(`/teacher/exams/${exam.id}`); revalidatePath(`/teacher/exams/${exam.id}/edit`); revalidatePath(`/teacher/exams/${exam.id}/marking-scheme`);
    regenerationDiagnostic(slotId, stage, "ok");
    return { ok: true, revision };
    } finally {
      if (!reservationClosed) await failAiReservation(teacherId, reservationId);
    }
  } catch (error) {
    regenerationDiagnostic(slotId, stage, "failed");
    return { ok: false, error: error instanceof ExamEditorError || error instanceof AiAbuseControlError ? error.message : "Question regeneration failed. The original question and marking scheme were preserved." };
  }
}
