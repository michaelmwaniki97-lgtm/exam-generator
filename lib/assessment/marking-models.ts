import type { MarkingModelHint } from "./profiles.ts";
import type { QuestionFamily } from "../blueprint/types.ts";
import { isSafeEducationalText } from "./rich-content.ts";

export const MARKING_LIMITS = {
  criteria: 8,
  criterionCharacters: 120,
  descriptorCharacters: 800,
  methodSteps: 12,
  answerCharacters: 12_000,
} as const;

export type MarkingModel = Exclude<MarkingModelHint, "mixed">;
export type RubricCriterion = {
  criterion: string;
  descriptor: string;
  marks: number;
};
export type NumericalMethod = {
  finalAnswer: string;
  methodSteps: Array<{ step: string; marks: number }>;
  accuracyMarks: number;
  units?: string;
  tolerance?: string;
  alternativeMethod?: string;
};

const NUMERICAL = new Set<QuestionFamily>([
  "short_computation", "structured_calculation", "multi_step_problem_solving",
  "application_context_problem", "mathematical_reasoning", "scientific_calculation",
  "practical_calculation",
]);
const ESSAY = new Set<QuestionFamily>(["extended_response", "set_text_response"]);
const COMPOSITION = new Set<QuestionFamily>(["creative_composition", "insha"]);

export function allowedMarkingModels(
  family: QuestionFamily,
  hint: MarkingModelHint
): MarkingModel[] {
  if (COMPOSITION.has(family)) return ["composition_rubric"];
  if (family.startsWith("practical_")) return ["practical_rubric"];
  if (ESSAY.has(family)) return ["essay_rubric"];
  if (NUMERICAL.has(family)) return ["numerical_method"];
  if (hint === "performance_rubric" && family === "rich_application_task") return ["performance_rubric"];
  return ["point_based"];
}

function text(value: unknown, max: number): value is string {
  return isSafeEducationalText(value, max);
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

const GENERIC = /^(?:criterion|descriptor|content|answer|method|working|correct answer|marks?|step|point)\s*\d*$/i;

export function validateRubricCriteria(
  criteria: unknown,
  expectedMarks: number
): string[] {
  if (!Array.isArray(criteria) || criteria.length < 1 || criteria.length > MARKING_LIMITS.criteria) return ["rubric criteria count is invalid"];
  const names = new Set<string>();
  let total = 0;
  for (const item of criteria) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return ["rubric criterion is malformed"];
    const criterion = (item as Record<string, unknown>).criterion;
    const descriptor = (item as Record<string, unknown>).descriptor;
    const marks = (item as Record<string, unknown>).marks;
    if (!text(criterion, MARKING_LIMITS.criterionCharacters) || GENERIC.test(criterion) || !text(descriptor, MARKING_LIMITS.descriptorCharacters) || GENERIC.test(descriptor) || !positiveInteger(marks)) return ["rubric criterion must be substantive and use positive integer marks"];
    const key = criterion.trim().toLocaleLowerCase();
    if (names.has(key)) return ["rubric criteria must be unique"];
    names.add(key); total += marks;
  }
  return total === expectedMarks ? [] : [`rubric criteria total ${total}, expected ${expectedMarks}`];
}

export function validateNumericalMethod(
  method: unknown,
  expectedMarks: number
): string[] {
  if (!method || typeof method !== "object" || Array.isArray(method)) return ["numerical method details are missing"];
  const value = method as Record<string, unknown>;
  if (!text(value.finalAnswer, MARKING_LIMITS.answerCharacters)) return ["numerical final answer is missing"];
  if (!Array.isArray(value.methodSteps) || value.methodSteps.length < 1 || value.methodSteps.length > MARKING_LIMITS.methodSteps) return ["numerical method steps are missing or excessive"];
  let total = 0;
  for (const item of value.methodSteps) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return ["numerical method step is malformed"];
    const step = (item as Record<string, unknown>).step;
    const marks = (item as Record<string, unknown>).marks;
    if (!text(step, MARKING_LIMITS.descriptorCharacters) || GENERIC.test(step) || !positiveInteger(marks)) return ["numerical method steps must be substantive and use positive integer marks"];
    total += marks;
  }
  if (!nonNegativeInteger(value.accuracyMarks)) return ["numerical accuracy marks are invalid"];
  total += value.accuracyMarks;
  if (value.units !== undefined && !text(value.units, 80)) return ["numerical units are invalid"];
  if (value.tolerance !== undefined && !text(value.tolerance, 160)) return ["numerical tolerance is invalid"];
  if (value.alternativeMethod !== undefined && !text(value.alternativeMethod, 1_000)) return ["alternative numerical method is invalid"];
  return total === expectedMarks ? [] : [`numerical method total ${total}, expected ${expectedMarks}`];
}
