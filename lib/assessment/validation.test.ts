import assert from "node:assert/strict";
import test from "node:test";
import {
  validateAssessmentSelection,
  validateBasicExamInput,
} from "./validation.ts";

const validInput = {
  educationSystem: "CBC",
  level: "Lower Primary",
  gradeId: "11111111-1111-4111-8111-111111111111",
  subjectId: "22222222-2222-4222-8222-222222222222",
  term: "Term 1",
  topicIds: ["33333333-3333-4333-8333-333333333333"],
  textbookId: "",
  examType: "cat",
  componentId: "",
  year: 2026,
  marks: 30,
  duration: 45,
  difficulty: "medium",
};

const limits = {
  marks: { min: 1, max: 300 },
  durationMinutes: { min: 1, max: 360 },
};

test("valid application exam settings are accepted", () => {
  assert.equal(validateBasicExamInput(validInput, limits), null);
});

test("invalid limits, difficulty, term, and duplicate curriculum IDs are rejected", () => {
  assert.match(
    validateBasicExamInput({ ...validInput, marks: 301 }, limits) ?? "",
    /between 1 and 300/
  );
  assert.match(
    validateBasicExamInput({ ...validInput, duration: 0 }, limits) ?? "",
    /between 1 and 360/
  );
  assert.match(
    validateBasicExamInput({ ...validInput, difficulty: "extreme" }, limits) ?? "",
    /valid difficulty/
  );
  assert.match(
    validateBasicExamInput({ ...validInput, term: "Term 4" }, limits) ?? "",
    /valid term/
  );
  assert.match(
    validateBasicExamInput(
      {
        ...validInput,
        topicIds: [
          "33333333-3333-4333-8333-333333333333",
          "33333333-3333-4333-8333-333333333333",
        ],
      },
      limits
    ) ?? "",
    /duplicate/
  );
});

test("malformed IDs, excessive selections, and invalid years are rejected", () => {
  assert.match(
    validateBasicExamInput({ ...validInput, gradeId: "grade" }, limits) ?? "",
    /Grade or Form is invalid/
  );
  assert.match(
    validateBasicExamInput({ ...validInput, topicIds: ["topic"] }, limits) ?? "",
    /invalid record/
  );
  const tooMany = Array.from(
    { length: 201 },
    (_, index) => `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`
  );
  assert.match(
    validateBasicExamInput({ ...validInput, topicIds: tooMany }, limits) ?? "",
    /no more than 200/
  );
  assert.match(
    validateBasicExamInput({ ...validInput, year: 1999 }, limits) ?? "",
    /between 2000 and 2100/
  );
  assert.match(
    validateBasicExamInput({ ...validInput, textbookId: "textbook" }, limits) ?? "",
    /textbook is invalid/
  );
});

test("allowed assessment types are accepted and injected types are rejected", () => {
  assert.equal(
    validateAssessmentSelection({
      assessmentTypeId: "cat",
      examStructureId: "standard",
      componentId: "",
      allowedAssessmentTypeIds: ["cat", "custom"],
      allowedExamStructureIds: ["standard"],
      componentRule: null,
    }),
    null
  );
  assert.match(
    validateAssessmentSelection({
      assessmentTypeId: "mock",
      examStructureId: "standard",
      componentId: "",
      allowedAssessmentTypeIds: ["cat", "custom"],
      allowedExamStructureIds: ["standard"],
      componentRule: null,
    }) ?? "",
    /not available/
  );
});

test("SOURCE_REQUIRED rules never authorize an injected official component", () => {
  const sourceRequiredRule = {
    verificationStatus: "SOURCE_REQUIRED" as const,
    components: [],
    componentSelectionRequired: false,
  };

  assert.equal(
    validateAssessmentSelection({
      assessmentTypeId: "mock",
      examStructureId: "standard",
      componentId: "",
      allowedAssessmentTypeIds: ["mock"],
      allowedExamStructureIds: ["standard"],
      componentRule: sourceRequiredRule,
    }),
    null
  );
  assert.match(
    validateAssessmentSelection({
      assessmentTypeId: "mock",
      examStructureId: "standard",
      componentId: "paper-1",
      allowedAssessmentTypeIds: ["mock"],
      allowedExamStructureIds: ["standard"],
      componentRule: sourceRequiredRule,
    }) ?? "",
    /cannot be used/
  );
});
