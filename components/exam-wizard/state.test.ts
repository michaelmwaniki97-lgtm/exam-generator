import assert from "node:assert/strict";
import test from "node:test";
import { transitionWizardData } from "./state.ts";
import { EMPTY_WIZARD_DATA, type WizardData } from "./types.ts";

function filledData(): WizardData {
  return {
    ...EMPTY_WIZARD_DATA,
    educationSystem: "CBC",
    level: "Lower Primary",
    gradeId: "grade-3",
    gradeName: "Grade 3",
    term: "Term 1",
    subjectId: "math",
    subjectName: "Mathematics",
    textbookId: "book",
    textbookName: "Book",
    topicIds: ["sub-strand"],
    examType: "cat",
    componentId: "component",
    marks: 30,
    duration: 45,
    difficulty: "medium",
  };
}

test("changing Grade/Form clears subject, assessment, component, and curriculum", () => {
  const next = transitionWizardData(filledData(), {
    gradeId: "grade-4",
    gradeName: "Grade 4",
  });

  assert.equal(next.subjectId, "");
  assert.equal(next.examType, "");
  assert.equal(next.examStructure, "standard");
  assert.equal(next.componentId, "");
  assert.deepEqual(next.topicIds, []);
});

test("changing subject clears curriculum and component while preserving a valid school type", () => {
  const next = transitionWizardData(
    filledData(),
    { subjectId: "english", subjectName: "English" },
    { allowedAssessmentTypeIds: ["cat", "custom"] }
  );

  assert.equal(next.examType, "cat");
  assert.equal(next.componentId, "");
  assert.equal(next.textbookId, "");
  assert.deepEqual(next.topicIds, []);
});

test("changing context clears an assessment type that is no longer valid", () => {
  const previous = { ...filledData(), examType: "quiz" as const };
  const next = transitionWizardData(
    previous,
    { subjectId: "physics", subjectName: "Physics" },
    { allowedAssessmentTypeIds: ["cat", "mock"] }
  );

  assert.equal(next.examType, "");
});

test("changing assessment type always clears the previous component", () => {
  const next = transitionWizardData(filledData(), { examType: "end_term" });
  assert.equal(next.componentId, "");
});

test("changing a Form 4 Mock subject clears the previous KCSE component", () => {
  const chemistry: WizardData = {
    ...filledData(),
    educationSystem: "8-4-4",
    level: "Secondary",
    gradeId: "form-4",
    gradeName: "Form 4",
    subjectId: "chemistry",
    subjectName: "Chemistry",
    examType: "mock",
    examStructure: "kcse_style",
    componentId: "kcse-2026-233-3",
  };
  const mathematics = transitionWizardData(
    chemistry,
    { subjectId: "mathematics", subjectName: "Mathematics" },
    {
      allowedAssessmentTypeIds: ["mock"],
      allowedExamStructureIds: ["kcse_style"],
    }
  );

  assert.equal(mathematics.examType, "mock");
  assert.equal(mathematics.componentId, "");
  assert.equal(mathematics.examStructure, "kcse_style");
});

function formThreeChemistry(): WizardData {
  return {
    ...filledData(),
    educationSystem: "8-4-4",
    level: "Secondary",
    gradeId: "form-3",
    gradeName: "Form 3",
    subjectId: "chemistry",
    subjectName: "Chemistry",
    examType: "end_term",
    examStructure: "kcse_style",
    componentId: "kcse-2026-233-3",
  };
}

test("switching KCSE-style to Standard clears the component", () => {
  const next = transitionWizardData(
    formThreeChemistry(),
    { examStructure: "standard" },
    { allowedExamStructureIds: ["standard", "kcse_style"] }
  );

  assert.equal(next.examStructure, "standard");
  assert.equal(next.componentId, "");
});

test("changing Form 3 to Form 2 clears structure and component", () => {
  const next = transitionWizardData(formThreeChemistry(), {
    gradeId: "form-2",
    gradeName: "Form 2",
  });

  assert.equal(next.examType, "");
  assert.equal(next.examStructure, "standard");
  assert.equal(next.componentId, "");
});

test("changing End Term to CAT clears KCSE-style structure and component", () => {
  const next = transitionWizardData(
    formThreeChemistry(),
    { examType: "cat" },
    {
      allowedAssessmentTypeIds: ["cat"],
      allowedExamStructureIds: ["standard"],
    }
  );

  assert.equal(next.examType, "cat");
  assert.equal(next.examStructure, "standard");
  assert.equal(next.componentId, "");
});

test("changing Chemistry to Mathematics clears the Chemistry component", () => {
  const next = transitionWizardData(
    formThreeChemistry(),
    { subjectId: "mathematics", subjectName: "Mathematics" },
    {
      allowedAssessmentTypeIds: ["end_term"],
      allowedExamStructureIds: ["standard", "kcse_style"],
    }
  );

  assert.equal(next.examType, "end_term");
  assert.equal(next.examStructure, "kcse_style");
  assert.equal(next.componentId, "");
});
