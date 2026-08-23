import type { ExamQuestion, MarkingSchemeEntry } from "../ai/generation-core.ts";
import type { ExamBlueprint } from "../blueprint/types.ts";
import { INVALID_STORED_CONTENT_MESSAGE, storedContentForDisplayOrThrow } from "../exam-editor/core.ts";
import { isSafeEducationalText } from "../assessment/rich-content.ts";

export const PRINT_LIMITS = { questions: 200, sections: 30, serializedCharacters: 1_000_000 } as const;

export type ExamDocumentKind = "student" | "marking";
export type ExamDocumentInput = {
  id: string; examType: string; marks: number; duration: number; term: string | null; year: number | null;
  school: string | null; content: unknown; markingContent?: unknown;
};
export type ExamDocumentSection = {
  id: string; title: string; instructions: string[]; questions: ExamQuestion[];
  marks: number; markAuthority: "OFFICIAL_EXACT" | "GENERATION_FLEXIBLE" | "LEGACY";
  displaySectionMarks: boolean;
};
export type ExamDocument = {
  id: string; kind: ExamDocumentKind; school: string | null; title: string; assessmentLabel: string;
  subject: string; grade: string; level: string; term: string | null; year: number | null;
  durationMinutes: number; totalMarks: number; component: string | null; paperCode: string | null;
  instructions: string[]; compactCandidateFields: boolean; authorityNotice: string | null;
  sections: ExamDocumentSection[]; markingEntries: MarkingSchemeEntry[];
};

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function cleanLine(value: string): string[] { return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function blueprintFrom(meta: Record<string, unknown>): ExamBlueprint | null {
  const value = meta.blueprint;
  if (value === undefined) return null;
  if (!record(value) || !Number.isInteger(value.totalMarks) || !Number.isInteger(value.durationMinutes) || !Array.isArray(value.sections) || !Array.isArray(value.questionSlots) || !record(value.assessmentProfile) || !record(value.examStructure) || !isSafeEducationalText(value.examStructure.structureOrigin, 120) || !record(value.assessmentType) || !isSafeEducationalText(value.assessmentType.id, 120)) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  if (value.component !== null && value.component !== undefined && (!record(value.component) || !isSafeEducationalText(value.component.displayName, 500) || !isSafeEducationalText(value.component.paperCode, 120))) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  if (!record(value.assessmentProfile.paper) || (value.assessmentProfile.paper.paperCode !== null && value.assessmentProfile.paper.paperCode !== undefined && !isSafeEducationalText(value.assessmentProfile.paper.paperCode, 120)) || !["OFFICIAL_VERIFIED", "SCHOOL_HEURISTIC", "UNKNOWN"].includes(String(value.assessmentProfile.ruleStatus))) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  for (const section of value.sections) {
    if (!record(section) || !isSafeEducationalText(section.id, 120) || !Number.isInteger(section.targetMarks) || !["OFFICIAL_EXACT", "GENERATION_FLEXIBLE"].includes(String(section.markAuthority)) || !Array.isArray(section.instructions) || section.instructions.length > 20 || !section.instructions.every((instruction) => isSafeEducationalText(instruction, 500))) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  }
  for (const slot of value.questionSlots) {
    if (!record(slot) || !isSafeEducationalText(slot.id, 120) || !Number.isInteger(slot.targetMarks) || Number(slot.targetMarks) <= 0) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  }
  return value as unknown as ExamBlueprint;
}
function text(meta: Record<string, unknown>, key: string, fallback: string): string { return typeof meta[key] === "string" && meta[key] ? String(meta[key]) : fallback; }

export function parseExamDocumentKind(searchParams: URLSearchParams): ExamDocumentKind {
  const values = searchParams.getAll("kind");
  if (values.length === 0) return "student";
  if (values.length !== 1 || (values[0] !== "student" && values[0] !== "marking")) throw new Error("Invalid document kind.");
  return values[0];
}

export function safePdfFilename(parts: Array<string | number | null | undefined>, marking = false): string {
  const base = parts.filter((part) => part !== null && part !== undefined && String(part).trim()).map((part) => String(part).normalize("NFKD").replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ").replace(/[^a-zA-Z0-9._ -]+/g, " ").trim().replace(/[ .]+/g, "_")).filter(Boolean).join("_").slice(0, marking ? 150 : 170) || "Exam";
  return `${base}${marking ? "_Marking_Scheme" : ""}.pdf`;
}

export function buildExamDocument(input: ExamDocumentInput, kind: ExamDocumentKind): ExamDocument {
  if (!isSafeEducationalText(input.id, 120) || !isSafeEducationalText(input.examType, 160) || !Number.isInteger(input.marks) || input.marks <= 0 || !Number.isInteger(input.duration) || input.duration <= 0 || (input.term !== null && !isSafeEducationalText(input.term, 120)) || (input.year !== null && !Number.isInteger(input.year)) || (input.school !== null && !isSafeEducationalText(input.school, 500))) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  let size = 0;
  try { size = JSON.stringify([input.content, input.markingContent]).length; } catch { throw new Error(INVALID_STORED_CONTENT_MESSAGE); }
  if (size > PRINT_LIMITS.serializedCharacters) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  const stored = storedContentForDisplayOrThrow(input.content, kind === "marking" ? input.markingContent : undefined);
  if (stored.exam.sections.length > PRINT_LIMITS.sections) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  const questions = stored.exam.sections.flatMap((section) => section.questions);
  if (questions.length > PRINT_LIMITS.questions) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  const meta = stored.exam.meta;
  for (const key of ["subjectName", "gradeName", "level"] as const) if (meta[key] !== undefined && !isSafeEducationalText(meta[key], 500)) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  const blueprint = blueprintFrom(meta);
  if (blueprint) {
    const questionTotal = questions.reduce((sum, question) => sum + question.marks, 0);
    if (input.marks !== blueprint.totalMarks || questionTotal !== blueprint.totalMarks || input.duration !== blueprint.durationMinutes) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
    if (blueprint.questionSlots.length) {
      const expected = new Map(blueprint.questionSlots.map((slot) => [slot.id, slot]));
      if (questions.length !== expected.size || questions.some((question) => !question.slotId || expected.get(question.slotId)?.targetMarks !== question.marks)) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
    }
    if (blueprint.sections.length !== stored.exam.sections.length || blueprint.sections.some((section, index) => stored.exam.sections[index].id !== section.id || stored.exam.sections[index].questions.reduce((sum, question) => sum + question.marks, 0) !== section.targetMarks)) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
  }
  const profile = blueprint?.assessmentProfile;
  const structure = blueprint?.examStructure.structureOrigin;
  const isKjsea = structure === "KJSEA_STYLE_PRACTICE";
  const isKcse = structure?.startsWith("KCSE_STYLE_") ?? false;
  const authorityNotice = isKjsea
    ? "School-generated KJSEA-style practice material. This paper is not issued or endorsed by KNEC."
    : isKcse ? "School-generated KCSE-style practice material. Component identity and duration may be verified; this paper is not issued or endorsed by KNEC." : null;
  const assessmentId = blueprint?.assessmentType.id;
  const compactCandidateFields = assessmentId === "quiz" || assessmentId === "cat" || assessmentId === "assignment";
  const component = blueprint?.component?.displayName ?? null;
  const paperCode = blueprint?.component?.paperCode ?? profile?.paper.paperCode ?? null;
  const sections: ExamDocumentSection[] = stored.exam.sections.map((section, index) => {
    const canonical = blueprint?.sections[index];
    const marks = section.questions.reduce((sum, question) => sum + question.marks, 0);
    const authority = canonical?.markAuthority ?? "LEGACY";
    return { id: section.id ?? canonical?.id ?? `section-${index + 1}`, title: section.title, instructions: canonical?.instructions ?? [], questions: section.questions, marks, markAuthority: authority, displaySectionMarks: authority === "OFFICIAL_EXACT" || profile?.ruleStatus === "SCHOOL_HEURISTIC" || !blueprint };
  });
  if (kind === "marking") {
    if (!stored.marking || stored.marking.entries.length !== questions.length) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
    const marksBySlot = new Map(questions.map((question) => [question.slotId || `number-${question.number}`, question.marks]));
    for (const entry of stored.marking.entries) {
      const key = entry.slotId || `number-${entry.number}`; const marks = marksBySlot.get(key);
      if (marks === undefined || entry.marks !== marks) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
      if (entry.allocations && entry.allocations.reduce((sum, allocation) => sum + allocation.marks, 0) !== marks) throw new Error(INVALID_STORED_CONTENT_MESSAGE);
    }
  }
  const subject = text(meta, "subjectName", "Subject"); const grade = text(meta, "gradeName", "Class");
  const title = `${input.examType}${paperCode ? ` — ${paperCode}` : ""}`;
  return {
    id: input.id, kind, school: input.school?.trim() || null, title, assessmentLabel: input.examType,
    subject, grade, level: text(meta, "level", ""), term: input.term, year: input.year,
    durationMinutes: blueprint?.durationMinutes ?? input.duration, totalMarks: blueprint?.totalMarks ?? input.marks,
    component, paperCode, instructions: cleanLine(stored.exam.instructions), compactCandidateFields,
    authorityNotice, sections, markingEntries: stored.marking?.entries ?? [],
  };
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60); const remainder = minutes % 60;
  if (!hours) return `${remainder} minutes`;
  return `${hours} hour${hours === 1 ? "" : "s"}${remainder ? ` ${remainder} minutes` : ""}`;
}
