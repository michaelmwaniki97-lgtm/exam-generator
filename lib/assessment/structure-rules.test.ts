import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAssessmentRules,
  type AssessmentContext,
  type ExamStructure,
} from "./rules.ts";
import { validateAssessmentSelection } from "./validation.ts";

function formContext(gradeName: string, subjectName: string): AssessmentContext {
  return {
    educationSystem: "8-4-4",
    level: "Secondary",
    gradeName,
    subjectName,
  };
}

function componentCodes(
  context: AssessmentContext,
  assessmentTypeId: string,
  examStructure?: ExamStructure
): string[] {
  return (
    resolveAssessmentRules(context, assessmentTypeId, examStructure)
      .officialComponentRule?.components.map((component) => component.paperCode) ?? []
  );
}

function validateSelection({
  context,
  assessmentTypeId,
  examStructure,
  componentId,
}: {
  context: AssessmentContext;
  assessmentTypeId: string;
  examStructure: ExamStructure;
  componentId: string;
}): string | null {
  const rules = resolveAssessmentRules(
    context,
    assessmentTypeId,
    examStructure
  );
  return validateAssessmentSelection({
    assessmentTypeId,
    examStructureId: examStructure,
    componentId,
    allowedAssessmentTypeIds: rules.allowedAssessmentTypes.map(
      (type) => type.id
    ),
    allowedExamStructureIds: rules.allowedExamStructures,
    componentRule: rules.officialComponentRule,
  });
}

test("Form 4 Chemistry keeps Mock and adds optional KCSE-style End Term", () => {
  const chemistry = formContext("Form 4", "Chemistry");
  const mock = resolveAssessmentRules(chemistry, "mock");
  const standardEndTerm = resolveAssessmentRules(
    chemistry,
    "end_term",
    "standard"
  );
  const kcseEndTerm = resolveAssessmentRules(
    chemistry,
    "end_term",
    "kcse_style"
  );

  assert.deepEqual(mock.allowedExamStructures, ["kcse_style"]);
  assert.equal(mock.defaultExamStructure, "kcse_style");
  assert.deepEqual(componentCodes(chemistry, "mock"), [
    "233/1",
    "233/2",
    "233/3",
  ]);
  assert.deepEqual(standardEndTerm.allowedExamStructures, [
    "standard",
    "kcse_style",
  ]);
  assert.equal(standardEndTerm.officialComponentRule, null);
  assert.deepEqual(componentCodes(chemistry, "end_term", "kcse_style"), [
    "233/1",
    "233/2",
    "233/3",
  ]);
  assert.strictEqual(
    mock.officialComponentRule,
    kcseEndTerm.officialComponentRule,
    "Mock and End Term must reuse the same canonical component rule"
  );
});

test("Form 3 Chemistry offers Standard or KCSE-style for End Term and Revision", () => {
  const chemistry = formContext("Form 3", "Chemistry");

  assert.deepEqual(componentCodes(chemistry, "end_term", "standard"), []);
  assert.deepEqual(componentCodes(chemistry, "end_term", "kcse_style"), [
    "233/1",
    "233/2",
    "233/3",
  ]);
  assert.deepEqual(componentCodes(chemistry, "revision_test", "standard"), []);
  assert.deepEqual(
    componentCodes(chemistry, "revision_test", "kcse_style"),
    ["233/1", "233/2", "233/3"]
  );
  assert.equal(
    resolveAssessmentRules(chemistry, "end_term").defaultExamStructure,
    "standard"
  );
  assert.equal(
    resolveAssessmentRules(chemistry, "revision_test").defaultExamStructure,
    "standard"
  );
});

test("Form 3 KCSE-style remains subject-specific", () => {
  assert.deepEqual(
    componentCodes(
      formContext("Form 3", "Mathematics"),
      "end_term",
      "kcse_style"
    ),
    ["121/1", "121/2"]
  );
  assert.deepEqual(
    componentCodes(
      formContext("Form 3", "Christian Religious Education"),
      "end_term",
      "kcse_style"
    ),
    ["313/1", "313/2"]
  );
});

test("KCSE-style structures remain isolated from unsupported contexts", () => {
  const gradeSevenIntegratedScience: AssessmentContext = {
    educationSystem: "CBC",
    level: "Junior School",
    gradeName: "Grade 7",
    subjectName: "Integrated Science",
  };

  assert.deepEqual(
    componentCodes(formContext("Form 3", "Biology"), "cat", "kcse_style"),
    []
  );
  assert.deepEqual(
    componentCodes(formContext("Form 2", "Biology"), "end_term", "kcse_style"),
    []
  );
  assert.deepEqual(
    componentCodes(gradeSevenIntegratedScience, "end_term", "kcse_style"),
    []
  );
});

test("server contract accepts only canonical structure and component combinations", () => {
  const formFourChemistry = formContext("Form 4", "Chemistry");
  const formThreeChemistry = formContext("Form 3", "Chemistry");
  const chemistryPracticalId = resolveAssessmentRules(
    formFourChemistry,
    "mock"
  ).officialComponentRule!.components[2].id;

  assert.equal(
    validateSelection({
      context: formFourChemistry,
      assessmentTypeId: "mock",
      examStructure: "kcse_style",
      componentId: chemistryPracticalId,
    }),
    null
  );
  assert.equal(
    validateSelection({
      context: formFourChemistry,
      assessmentTypeId: "end_term",
      examStructure: "kcse_style",
      componentId: chemistryPracticalId,
    }),
    null
  );
  assert.equal(
    validateSelection({
      context: formThreeChemistry,
      assessmentTypeId: "end_term",
      examStructure: "kcse_style",
      componentId: chemistryPracticalId,
    }),
    null
  );
  assert.equal(
    validateSelection({
      context: formThreeChemistry,
      assessmentTypeId: "revision_test",
      examStructure: "kcse_style",
      componentId: chemistryPracticalId,
    }),
    null
  );

  assert.match(
    validateSelection({
      context: formThreeChemistry,
      assessmentTypeId: "cat",
      examStructure: "kcse_style",
      componentId: chemistryPracticalId,
    }) ?? "",
    /structure is not available/
  );
  assert.match(
    validateSelection({
      context: formContext("Form 2", "Chemistry"),
      assessmentTypeId: "end_term",
      examStructure: "kcse_style",
      componentId: chemistryPracticalId,
    }) ?? "",
    /structure is not available/
  );
  assert.match(
    validateSelection({
      context: formContext("Form 3", "Mathematics"),
      assessmentTypeId: "end_term",
      examStructure: "kcse_style",
      componentId: chemistryPracticalId,
    }) ?? "",
    /not valid/
  );
  assert.match(
    validateSelection({
      context: formContext("Form 3", "Christian Religious Education"),
      assessmentTypeId: "end_term",
      examStructure: "kcse_style",
      componentId: "kcse-2026-313-3",
    }) ?? "",
    /not valid/
  );
  assert.match(
    validateSelection({
      context: formThreeChemistry,
      assessmentTypeId: "end_term",
      examStructure: "standard",
      componentId: chemistryPracticalId,
    }) ?? "",
    /cannot be used/
  );
});
