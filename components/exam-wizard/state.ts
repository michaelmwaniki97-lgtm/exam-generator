import type { ExamStructure } from "@/lib/assessment/rules";
import type { WizardData } from "./types";

type TransitionOptions = {
  allowedAssessmentTypeIds?: readonly string[];
  allowedExamStructureIds?: readonly ExamStructure[];
};

function defaultExamStructure(
  allowedExamStructureIds?: readonly ExamStructure[]
): ExamStructure {
  return allowedExamStructureIds?.length === 1 &&
    allowedExamStructureIds[0] === "kcse_style"
    ? "kcse_style"
    : "standard";
}

const SUBJECT_RESET: Partial<WizardData> = {
  subjectId: "",
  subjectName: "",
  textbookId: "",
  textbookName: "",
  topicIds: [],
  examType: "",
  examStructure: "standard",
  componentId: "",
};

export function transitionWizardData(
  previous: WizardData,
  patch: Partial<WizardData>,
  options: TransitionOptions = {}
): WizardData {
  let next = { ...previous, ...patch };

  if (
    "educationSystem" in patch &&
    patch.educationSystem !== previous.educationSystem
  ) {
    next = {
      ...next,
      level: "",
      gradeId: "",
      gradeName: "",
      ...SUBJECT_RESET,
    };
  } else if ("level" in patch && patch.level !== previous.level) {
    next = {
      ...next,
      gradeId: "",
      gradeName: "",
      ...SUBJECT_RESET,
    };
  } else if ("gradeId" in patch && patch.gradeId !== previous.gradeId) {
    next = { ...next, ...SUBJECT_RESET };
  }

  if ("subjectId" in patch && patch.subjectId !== previous.subjectId) {
    const assessmentStillAllowed = Boolean(
      previous.examType &&
        options.allowedAssessmentTypeIds?.includes(previous.examType)
    );
    const structureStillAllowed = Boolean(
      assessmentStillAllowed &&
        options.allowedExamStructureIds?.includes(previous.examStructure)
    );
    next = {
      ...next,
      textbookId: "",
      textbookName: "",
      topicIds: [],
      examType: assessmentStillAllowed ? previous.examType : "",
      examStructure: structureStillAllowed
        ? previous.examStructure
        : defaultExamStructure(options.allowedExamStructureIds),
      componentId: "",
    };
  }

  if ("examType" in patch && patch.examType !== previous.examType) {
    const requestedStructure = patch.examStructure;
    next.examStructure =
      requestedStructure &&
      options.allowedExamStructureIds?.includes(requestedStructure)
        ? requestedStructure
        : defaultExamStructure(options.allowedExamStructureIds);
    next.componentId = "";
  }

  if (
    "examStructure" in patch &&
    patch.examStructure !== previous.examStructure
  ) {
    next.examStructure =
      options.allowedExamStructureIds?.includes(patch.examStructure!)
        ? patch.examStructure!
        : defaultExamStructure(options.allowedExamStructureIds);
    next.componentId = "";
  }

  return next;
}

export function canProceedWizardStep(step: number, data: WizardData): boolean {
  switch (step) {
    case 1:
      return Boolean(data.educationSystem && data.level && data.gradeId);
    case 2:
      return Boolean(data.subjectId);
    case 3:
      return Boolean(data.examType && data.term);
    case 4:
      return data.topicIds.length > 0;
    case 5:
      return Boolean(
        data.difficulty &&
          Number.isInteger(data.marks) &&
          data.marks! > 0 &&
          Number.isInteger(data.duration) &&
          data.duration! > 0
      );
    default:
      return true;
  }
}
