import type { ExamBlueprint } from "../blueprint/types.ts";
import {
  describeViolations,
  type ExamQuestion,
  type ExamSection,
  type GeneratedExam,
  type MarkingSchemeEntry,
} from "../ai/generation-core.ts";

export const EDITOR_LIMITS = {
  questionText: 8_000,
  optionText: 1_000,
  answer: 12_000,
  markingNotes: 8_000,
  allocationLabel: 2_000,
} as const;

export type StoredExamContent = {
  instructions: string;
  sections: ExamSection[];
  meta: Record<string, unknown> & { blueprint?: ExamBlueprint };
};
export type StoredMarkingContent = { entries: MarkingSchemeEntry[] };
export type EditableSlotInput = {
  slotId: string;
  questionText: string;
  options?: string[];
  answer: string;
  markingNotes: string;
  allocationLabels: string[];
};

export class ExamEditorError extends Error {}

function clean(value: string, label: string, max: number): string {
  const result = value.trim();
  if (!result) throw new ExamEditorError(`${label} cannot be empty.`);
  if (result.length > max) throw new ExamEditorError(`${label} is too long.`);
  return result;
}

export function editableExamOrThrow(
  examContent: unknown,
  markingContent: unknown
): { exam: StoredExamContent; marking: StoredMarkingContent; blueprint: ExamBlueprint } {
  const exam = examContent as StoredExamContent;
  const marking = markingContent as StoredMarkingContent;
  if (!exam || !Array.isArray(exam.sections) || !exam.meta?.blueprint) {
    throw new ExamEditorError("This historical exam does not contain a complete blueprint and cannot be edited safely.");
  }
  if (!marking || !Array.isArray(marking.entries)) {
    throw new ExamEditorError("This exam does not have a compatible marking scheme and cannot be edited safely.");
  }
  const questions = exam.sections.flatMap((section) => section.questions ?? []);
  if (
    questions.length !== exam.meta.blueprint.questionSlots.length ||
    questions.some((question) => !question.slotId) ||
    marking.entries.length !== questions.length ||
    marking.entries.some((entry) => !entry.slotId)
  ) {
    throw new ExamEditorError("This historical exam uses an older format and cannot be edited safely.");
  }
  return { exam, marking, blueprint: exam.meta.blueprint };
}

function generated(exam: StoredExamContent, marking: StoredMarkingContent): GeneratedExam {
  return { instructions: exam.instructions, sections: exam.sections, marking_scheme: marking.entries };
}

export function validateCanonicalExam(
  exam: StoredExamContent,
  marking: StoredMarkingContent,
  blueprint: ExamBlueprint
): void {
  const problems = describeViolations(generated(exam, marking), blueprint);
  if (problems.length) {
    throw new ExamEditorError(`This exam cannot be edited safely: ${problems.join("; ")}`);
  }
}

export function applyEditableChanges(
  examContent: unknown,
  markingContent: unknown,
  inputs: readonly EditableSlotInput[]
): { exam: StoredExamContent; marking: StoredMarkingContent } {
  const { exam, marking, blueprint } = editableExamOrThrow(examContent, markingContent);
  const questions = exam.sections.flatMap((section) => section.questions);
  if (inputs.length !== questions.length) throw new ExamEditorError("The submitted exam is incomplete. Refresh and try again.");
  const inputBySlot = new Map(inputs.map((input) => [input.slotId, input]));
  if (inputBySlot.size !== inputs.length) throw new ExamEditorError("The submitted exam contains duplicate questions.");

  const nextSections = exam.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => {
      const input = inputBySlot.get(question.slotId);
      if (!input) throw new ExamEditorError("The submitted exam does not match the current exam. Refresh and try again.");
      let options: string[] | undefined;
      if (question.type === "objective") {
        if (!Array.isArray(input.options) || input.options.length !== 4) throw new ExamEditorError(`Question ${question.number} must have exactly four options.`);
        options = input.options.map((option, index) => clean(option, `Question ${question.number} option ${index + 1}`, EDITOR_LIMITS.optionText));
        if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== 4) throw new ExamEditorError(`Question ${question.number} options must be distinct.`);
      } else if (input.options !== undefined) {
        throw new ExamEditorError(`Question ${question.number} does not accept options.`);
      }
      return { ...question, text: clean(input.questionText, `Question ${question.number}`, EDITOR_LIMITS.questionText), ...(options ? { options } : {}) };
    }),
  }));

  const nextEntries = marking.entries.map((entry) => {
    const input = inputBySlot.get(entry.slotId!);
    if (!input) throw new ExamEditorError("The submitted marking scheme does not match the current exam. Refresh and try again.");
    const allocations = entry.allocations ?? [];
    if (input.allocationLabels.length !== allocations.length) throw new ExamEditorError(`Question ${entry.number} marking points are incomplete.`);
    return {
      ...entry,
      answer: clean(input.answer, `Question ${entry.number} model answer`, EDITOR_LIMITS.answer),
      marking_notes: clean(input.markingNotes, `Question ${entry.number} marking notes`, EDITOR_LIMITS.markingNotes),
      allocations: allocations.map((allocation, index) => ({ ...allocation, label: clean(input.allocationLabels[index], `Question ${entry.number} marking point ${index + 1}`, EDITOR_LIMITS.allocationLabel) })),
    };
  });

  const nextExam = { ...exam, sections: nextSections };
  const nextMarking = { ...marking, entries: nextEntries };
  validateCanonicalExam(nextExam, nextMarking, blueprint);
  return { exam: nextExam, marking: nextMarking };
}

function words(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((word) => word.length > 2));
}

export function materiallyDuplicates(candidate: string, others: readonly string[]): boolean {
  const a = words(candidate);
  if (a.size < 5) return others.some((other) => candidate.trim().toLocaleLowerCase() === other.trim().toLocaleLowerCase());
  return others.some((other) => {
    const b = words(other);
    const intersection = [...a].filter((word) => b.has(word)).length;
    const union = new Set([...a, ...b]).size;
    return union > 0 && intersection / union >= 0.75;
  });
}

export function replaceOneSlot(
  examContent: unknown,
  markingContent: unknown,
  slotId: string,
  question: ExamQuestion,
  entry: MarkingSchemeEntry
): { exam: StoredExamContent; marking: StoredMarkingContent } {
  const { exam, marking, blueprint } = editableExamOrThrow(examContent, markingContent);
  const current = exam.sections.flatMap((section) => section.questions).find((item) => item.slotId === slotId);
  if (!current) throw new ExamEditorError("The requested question no longer exists. Refresh and try again.");
  const others = exam.sections.flatMap((section) => section.questions).filter((item) => item.slotId !== slotId).map((item) => item.text);
  if (materiallyDuplicates(question.text, others)) throw new ExamEditorError("The regenerated question materially duplicates another question in this exam.");
  const nextExam = { ...exam, sections: exam.sections.map((section) => ({ ...section, questions: section.questions.map((item) => item.slotId === slotId ? question : item) })) };
  const nextMarking = { ...marking, entries: marking.entries.map((item) => item.slotId === slotId ? entry : item) };
  validateCanonicalExam(nextExam, nextMarking, blueprint);
  return { exam: nextExam, marking: nextMarking };
}
