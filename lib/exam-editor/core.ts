import { validateQuestionVisual } from "../assessment/question-visual.ts";
import type { ExamBlueprint } from "../blueprint/types.ts";
import {
  describeViolations,
  describeStructuralViolations,
  type ExamQuestion,
  type ExamSection,
  type GeneratedExam,
  type MarkingSchemeEntry,
} from "../ai/generation-core.ts";
import { describeSemanticViolations } from "../ai/semantic-quality.ts";
import { isSafeEducationalText, validateQuestionStimuli } from "../assessment/rich-content.ts";
import { validateNumericalMethod, validateRubricCriteria } from "../assessment/marking-models.ts";

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
  removeVisual?: boolean;
  questionText: string;
  options?: string[];
  answer: string;
  markingNotes: string;
  allocationLabels: string[];
  stimulusTextEdits?: Array<{ id: string; content: string }>;
  rubricDescriptors?: string[];
};

export class ExamEditorError extends Error {}
export const INVALID_STORED_CONTENT_MESSAGE = "This exam contains unsupported or invalid stored content and cannot be displayed safely.";

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalSafeText(value: unknown, max: number): boolean {
  return value === undefined || isSafeEducationalText(value, max);
}

function safeTextOrEmpty(value: unknown, max: number): value is string {
  return value === "" || isSafeEducationalText(value, max);
}

function safeStringArray(value: unknown, maxItems: number, maxCharacters: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => isSafeEducationalText(item, maxCharacters));
}

export function storedContentForDisplayOrThrow(
  examContent: unknown,
  markingContent?: unknown
): { exam: StoredExamContent; marking?: StoredMarkingContent } {
  if (!record(examContent) || !safeTextOrEmpty(examContent.instructions, 12_000) || !Array.isArray(examContent.sections) || !record(examContent.meta)) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
  for (const section of examContent.sections) {
    if (!record(section) || !optionalSafeText(section.id, 120) || !isSafeEducationalText(section.title, 500) || !Array.isArray(section.questions)) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
    for (const question of section.questions) {
      if (!record(question) || !optionalSafeText(question.slotId, 120) || !Number.isInteger(question.number) || !isSafeEducationalText(question.text, EDITOR_LIMITS.questionText) || !Number.isInteger(question.marks) || Number(question.marks) <= 0) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
      if (question.options !== undefined) {
        if (!safeStringArray(question.options, 4, EDITOR_LIMITS.optionText) || question.options.length < 1) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
      }
      if (validateQuestionVisual(question.visual).length) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
      if (validateQuestionStimuli(question.stimuli, ["passage", "extract", "table", "dataset", "graph", "diagram"]).length) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
    }
  }
  let marking: StoredMarkingContent | undefined;
  if (markingContent !== undefined) {
    if (!record(markingContent) || !Array.isArray(markingContent.entries)) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
    for (const entry of markingContent.entries) {
      if (!record(entry) || !optionalSafeText(entry.slotId, 120) || !Number.isInteger(entry.number) || !Number.isInteger(entry.marks) || Number(entry.marks) <= 0 || !safeTextOrEmpty(entry.marking_notes, EDITOR_LIMITS.markingNotes)) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
      if (entry.answer !== undefined && !isSafeEducationalText(entry.answer, EDITOR_LIMITS.answer)) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
      if (entry.markingModel !== undefined && !["point_based", "numerical_method", "essay_rubric", "composition_rubric", "practical_rubric", "performance_rubric"].includes(String(entry.markingModel))) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
      if (entry.rubric !== undefined && (!Number.isInteger(entry.marks) || validateRubricCriteria(entry.rubric, Number(entry.marks)).length)) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
      if (entry.numericalMethod !== undefined && (!Number.isInteger(entry.marks) || validateNumericalMethod(entry.numericalMethod, Number(entry.marks)).length)) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
      if (entry.allocations !== undefined && (!Array.isArray(entry.allocations) || entry.allocations.length > 200 || entry.allocations.some((allocation) => !record(allocation) || !isSafeEducationalText(allocation.label, EDITOR_LIMITS.allocationLabel) || !Number.isInteger(allocation.marks) || Number(allocation.marks) <= 0))) throw new ExamEditorError(INVALID_STORED_CONTENT_MESSAGE);
    }
    marking = markingContent as StoredMarkingContent;
  }
  return { exam: examContent as StoredExamContent, ...(marking ? { marking } : {}) };
}

function clean(value: string, label: string, max: number): string {
  const result = value.trim();
  if (!result) throw new ExamEditorError(`${label} cannot be empty.`);
  if (result.length > max) throw new ExamEditorError(`${label} is too long.`);
  if (!isSafeEducationalText(result, max)) throw new ExamEditorError(`${label} contains unsupported markup or executable content.`);
  return result;
}
function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}


export function editableExamOrThrow(
  examContent: unknown,
  markingContent: unknown
): { exam: StoredExamContent; marking: StoredMarkingContent; blueprint: ExamBlueprint } {
  const stored = storedContentForDisplayOrThrow(examContent, markingContent);
  const exam = stored.exam;
  const marking = stored.marking!;
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

export function validateCanonicalStructure(
  exam: StoredExamContent,
  marking: StoredMarkingContent,
  blueprint: ExamBlueprint
): void {
  const problems = describeStructuralViolations(generated(exam, marking), blueprint);
  if (problems.length) {
    throw new ExamEditorError(`This exam cannot be edited safely: ${problems.join("; ")}`);
  }
}

export function applyEditableChanges(
  examContent: unknown,
  markingContent: unknown,
  inputs: readonly EditableSlotInput[]
): { exam: StoredExamContent; marking: StoredMarkingContent; changedSlotIds: string[] } {
  const { exam, marking, blueprint } = editableExamOrThrow(examContent, markingContent);
  const questions = exam.sections.flatMap((section) => section.questions);
  if (inputs.length !== questions.length) throw new ExamEditorError("The submitted exam is incomplete. Refresh and try again.");
  const inputBySlot = new Map(inputs.map((input) => [input.slotId, input]));
  if (inputBySlot.size !== inputs.length) throw new ExamEditorError("The submitted exam contains duplicate questions.");
  const changedQuestionSlots = new Set<string>();
  const changedAnswerSlots = new Set<string>();
  const changedMarkingNotesSlots = new Set<string>();
  const changedAllocationSlots = new Set<string>();

  const nextSections = exam.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => {
      const input = inputBySlot.get(question.slotId);
      if (!input) throw new ExamEditorError("The submitted exam does not match the current exam. Refresh and try again.");
      let options: string[] | undefined;
      const text = clean(input.questionText, `Question ${question.number}`, EDITOR_LIMITS.questionText);
      if (question.type === "objective") {
        if (!Array.isArray(input.options) || input.options.length !== 4) throw new ExamEditorError(`Question ${question.number} must have exactly four options.`);
        options = input.options.map((option, index) => clean(option, `Question ${question.number} option ${index + 1}`, EDITOR_LIMITS.optionText));
        if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== 4) throw new ExamEditorError(`Question ${question.number} options must be distinct.`);
      } else if (input.options !== undefined) {
        throw new ExamEditorError(`Question ${question.number} does not accept options.`);
      }
      if (input.removeVisual !== undefined && typeof input.removeVisual !== "boolean") throw new ExamEditorError("Invalid visual removal request.");
      if (input.removeVisual && question.visual?.required) {
        const entry = marking.entries.find(e => e.slotId === question.slotId);
        const markingRewritten = entry?.rubric
          ? input.markingNotes !== entry.marking_notes || JSON.stringify(input.rubricDescriptors) !== JSON.stringify(entry.rubric.map(r => r.descriptor))
          : input.answer !== (entry?.answer ?? entry?.numericalMethod?.finalAnswer ?? "");
        if (text === question.text || !markingRewritten) throw new ExamEditorError(`Question ${question.number} requires its visual. Rewrite the question and answer or rubric to be self-contained before removing it.`);
      }
      const visualRemoved = !!input.removeVisual && !!question.visual;
      const changed = visualRemoved || text !== question.text || !sameStrings(options ?? [], question.options ?? []);
      const editableStimuli = (question.stimuli ?? []).filter((stimulus) => stimulus.type === "passage" || stimulus.type === "extract");
      const stimulusEdits = input.stimulusTextEdits ?? [];
      if (stimulusEdits.length !== editableStimuli.length || stimulusEdits.some((edit, index) => edit.id !== editableStimuli[index].id)) throw new ExamEditorError(`Question ${question.number} stimulus structure cannot be changed.`);
      const stimulusContent = new Map(stimulusEdits.map((edit) => [edit.id, clean(edit.content, `Question ${question.number} stimulus`, 5_000)]));
      const stimuli = question.stimuli?.map((stimulus) => (stimulus.type === "passage" || stimulus.type === "extract") ? { ...stimulus, content: stimulusContent.get(stimulus.id)! } : stimulus);
      const stimulusChanged = JSON.stringify(stimuli ?? []) !== JSON.stringify(question.stimuli ?? []);
      if (!changed && !stimulusChanged) return question;
      changedQuestionSlots.add(question.slotId);
      return { ...question, ...(visualRemoved ? { visual: undefined } : {}), text, ...(options ? { options } : {}), ...(stimuli ? { stimuli } : {}) };
    }),
  }));

  const nextEntries = marking.entries.map((entry) => {
    const input = inputBySlot.get(entry.slotId!);
    if (!input) throw new ExamEditorError("The submitted marking scheme does not match the current exam. Refresh and try again.");
    const allocations = entry.allocations ?? [];
    if (input.allocationLabels.length !== allocations.length) throw new ExamEditorError(`Question ${entry.number} marking points are incomplete.`);
    const markingNotes = clean(input.markingNotes, `Question ${entry.number} marking notes`, EDITOR_LIMITS.markingNotes);
    const allocationLabels = allocations.map((_allocation, index) => clean(input.allocationLabels[index], `Question ${entry.number} marking point ${index + 1}`, EDITOR_LIMITS.allocationLabel));
    let answer = entry.answer;
    let numericalMethod = entry.numericalMethod;
    let rubric = entry.rubric;
    if ((entry.markingModel ?? "point_based") === "point_based") answer = clean(input.answer, `Question ${entry.number} model answer`, EDITOR_LIMITS.answer);
    if (entry.markingModel === "numerical_method") {
      numericalMethod = { ...entry.numericalMethod!, finalAnswer: clean(input.answer, `Question ${entry.number} final answer`, EDITOR_LIMITS.answer) };
    }
    if (entry.rubric) {
      const descriptors = input.rubricDescriptors ?? [];
      if (descriptors.length !== entry.rubric.length) throw new ExamEditorError(`Question ${entry.number} rubric structure cannot be changed.`);
      rubric = entry.rubric.map((criterion, index) => ({ ...criterion, descriptor: clean(descriptors[index], `Question ${entry.number} rubric descriptor`, 800) }));
    } else if (input.rubricDescriptors?.length) throw new ExamEditorError(`Question ${entry.number} does not accept rubric criteria.`);
    const answerChanged = answer !== entry.answer || JSON.stringify(numericalMethod) !== JSON.stringify(entry.numericalMethod) || JSON.stringify(rubric) !== JSON.stringify(entry.rubric);
    const markingNotesChanged = markingNotes !== entry.marking_notes;
    const allocationsChanged = !sameStrings(allocationLabels, allocations.map((allocation) => allocation.label));
    const changed = answerChanged || markingNotesChanged || allocationsChanged;
    if (!changed) return entry;
    if (answerChanged) changedAnswerSlots.add(entry.slotId!);
    if (markingNotesChanged) changedMarkingNotesSlots.add(entry.slotId!);
    if (allocationsChanged) changedAllocationSlots.add(entry.slotId!);
    const base = { ...entry, marking_notes: markingNotes };
    if ((entry.markingModel ?? "point_based") === "point_based") return { ...base, answer, allocations: allocations.map((allocation, index) => ({ ...allocation, label: allocationLabels[index] })) };
    if (entry.markingModel === "numerical_method") return { ...base, numericalMethod };
    return { ...base, rubric };
  });

  const nextExam = { ...exam, sections: nextSections };
  const nextMarking = { ...marking, entries: nextEntries };
  validateCanonicalStructure(nextExam, nextMarking, blueprint);
  const pairSlots = new Set([...changedQuestionSlots, ...changedAnswerSlots]);
  const semanticProblems = describeSemanticViolations(generated(nextExam, nextMarking), {
    questionSlotIds: changedQuestionSlots,
    answerSlotIds: changedAnswerSlots,
    markingNotesSlotIds: changedMarkingNotesSlots,
    allocationSlotIds: changedAllocationSlots,
    pairSlotIds: pairSlots,
  });
  if (semanticProblems.length) {
    throw new ExamEditorError(`Edited content does not meet current quality requirements: ${semanticProblems.join("; ")}`);
  }
  return { exam: nextExam, marking: nextMarking, changedSlotIds: [...new Set([...changedQuestionSlots, ...changedAnswerSlots, ...changedMarkingNotesSlots, ...changedAllocationSlots])] };
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
  validateCanonicalStructure(nextExam, nextMarking, blueprint);
  const targetScope = new Set([slotId]);
  const semanticProblems = describeSemanticViolations(generated(nextExam, nextMarking), {
    questionSlotIds: targetScope,
    answerSlotIds: targetScope,
    markingNotesSlotIds: targetScope,
    allocationSlotIds: targetScope,
    pairSlotIds: targetScope,
  });
  if (semanticProblems.length) {
    throw new ExamEditorError(`The regenerated target does not meet current quality requirements: ${semanticProblems.join("; ")}`);
  }
  return { exam: nextExam, marking: nextMarking };
}
