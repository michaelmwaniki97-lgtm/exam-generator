import { UUID_PATTERN } from "../admin/validation.ts";

export type BasicExamInput = {
  educationSystem: string;
  level: string;
  gradeId: string;
  subjectId: string;
  term: string;
  topicIds: string[];
  textbookId: string;
  examType: string;
  componentId: string;
  year: number | null;
  marks: number | null;
  duration: number | null;
  difficulty: string;
};

export type ComponentRuleForValidation = {
  verificationStatus: "VERIFIED" | "SOURCE_REQUIRED";
  components: readonly { id: string }[];
  componentSelectionRequired: boolean;
} | null;

const TERMS = new Set(["Term 1", "Term 2", "Term 3"]);
const MAX_CURRICULUM_SELECTIONS = 200;
const MIN_EXAM_YEAR = 2000;
const MAX_EXAM_YEAR = 2100;
const DIFFICULTIES = new Set(["easy", "medium", "hard"]);

export function validateBasicExamInput(
  data: BasicExamInput,
  limits: {
    marks: { min: number; max: number };
    durationMinutes: { min: number; max: number };
  }
): string | null {
  if (!data.educationSystem || !data.level || !data.gradeId) {
    return "Class details are incomplete.";
  }
  if (!UUID_PATTERN.test(data.gradeId)) {
    return "The selected Grade or Form is invalid.";
  }
  if (!UUID_PATTERN.test(data.subjectId)) {
    return "The selected subject is invalid.";
  }
  if (!TERMS.has(data.term)) return "Please select a valid term.";
  if (
    !Number.isInteger(data.year) ||
    data.year! < MIN_EXAM_YEAR ||
    data.year! > MAX_EXAM_YEAR
  ) {
    return `Year must be a whole number between ${MIN_EXAM_YEAR} and ${MAX_EXAM_YEAR}.`;
  }
  if (!Array.isArray(data.topicIds) || data.topicIds.length === 0) {
    return "Please select at least one curriculum area.";
  }
  if (data.topicIds.length > MAX_CURRICULUM_SELECTIONS) {
    return `Select no more than ${MAX_CURRICULUM_SELECTIONS} curriculum areas.`;
  }
  if (
    data.topicIds.some(
      (id) => typeof id !== "string" || !UUID_PATTERN.test(id)
    )
  ) {
    return "The curriculum selection contains an invalid record.";
  }
  if (new Set(data.topicIds).size !== data.topicIds.length) {
    return "The curriculum selection contains duplicate records.";
  }
  if (data.textbookId && !UUID_PATTERN.test(data.textbookId)) {
    return "The selected textbook is invalid.";
  }
  if (!data.examType) return "Please select an assessment type.";
  if (!DIFFICULTIES.has(data.difficulty)) return "Please select a valid difficulty.";
  if (
    !Number.isInteger(data.marks) ||
    data.marks! < limits.marks.min ||
    data.marks! > limits.marks.max
  ) {
    return `Total marks must be a whole number between ${limits.marks.min} and ${limits.marks.max}.`;
  }
  if (
    !Number.isInteger(data.duration) ||
    data.duration! < limits.durationMinutes.min ||
    data.duration! > limits.durationMinutes.max
  ) {
    return `Duration must be a whole number between ${limits.durationMinutes.min} and ${limits.durationMinutes.max} minutes.`;
  }
  return null;
}

export function validateAssessmentSelection({
  assessmentTypeId,
  examStructureId,
  componentId,
  allowedAssessmentTypeIds,
  allowedExamStructureIds,
  componentRule,
}: {
  assessmentTypeId: string;
  examStructureId: string;
  componentId: string;
  allowedAssessmentTypeIds: readonly string[];
  allowedExamStructureIds: readonly string[];
  componentRule: ComponentRuleForValidation;
}): string | null {
  if (!allowedAssessmentTypeIds.includes(assessmentTypeId)) {
    return "The selected assessment type is not available for this class and subject.";
  }

  if (!allowedExamStructureIds.includes(examStructureId)) {
    return "The selected exam structure is not available for this class, subject, and assessment.";
  }

  if (examStructureId === "standard" && componentId) {
    return "A KCSE-style component cannot be used with a Standard School Exam.";
  }

  if (
    examStructureId === "kcse_style" &&
    (!componentRule || componentRule.verificationStatus !== "VERIFIED")
  ) {
    return "KCSE-style paper structure is not verified for this class, subject, and assessment.";
  }

  if (componentId) {
    if (!componentRule || componentRule.verificationStatus !== "VERIFIED") {
      return "The selected paper/component is not verified for this class and subject.";
    }
    if (!componentRule.components.some((component) => component.id === componentId)) {
      return "The selected paper/component is not valid for this assessment.";
    }
  }

  if (
    componentRule?.verificationStatus === "VERIFIED" &&
    componentRule.componentSelectionRequired &&
    !componentId
  ) {
    return "Please select a paper/component.";
  }

  return null;
}
