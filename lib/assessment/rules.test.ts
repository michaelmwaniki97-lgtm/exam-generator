import assert from "node:assert/strict";
import test from "node:test";
import {
  inferEducationSystem,
  isSupportedNewExamGrade,
  resolveAssessmentRules,
  resolveOfficialComponentRule,
  type AssessmentContext,
} from "./rules.ts";

const gradeThreeMathematics: AssessmentContext = {
  educationSystem: "CBC",
  level: "Lower Primary",
  gradeName: "Grade 3",
  subjectName: "Mathematics",
};

const formThreePhysics: AssessmentContext = {
  educationSystem: "8-4-4",
  level: "Secondary",
  gradeName: "Form 3",
  subjectName: "Physics",
};

test("supported Grades and Forms map to the correct education system", () => {
  assert.equal(inferEducationSystem("Grade 3"), "CBC");
  assert.equal(inferEducationSystem("Form 4"), "8-4-4");
  assert.equal(isSupportedNewExamGrade("Grade 9", "Junior School"), true);
  assert.equal(isSupportedNewExamGrade("Form 1", "Secondary"), true);
  assert.equal(isSupportedNewExamGrade("Grade 10", "Senior School"), false);
  assert.equal(isSupportedNewExamGrade("PP1", "Pre-Primary"), false);
});

test("Grade 3 Mathematics receives school formats without KCSE paper options", () => {
  const rules = resolveAssessmentRules(gradeThreeMathematics, "end_term");
  const ids = rules.allowedAssessmentTypes.map((type) => type.id);

  assert.ok(ids.includes("quiz"));
  assert.ok(ids.includes("diagnostic_assessment"));
  assert.equal(ids.includes("mock"), false);
  assert.equal(rules.officialComponentRule, null);
  assert.equal(resolveOfficialComponentRule(gradeThreeMathematics, "mock"), null);
});

test("unsupported Form mocks remain source-required until an authoritative component source is inspected", () => {
  const rules = resolveAssessmentRules(formThreePhysics, "mock");
  const ids = rules.allowedAssessmentTypes.map((type) => type.id);

  assert.ok(ids.includes("mock"));
  assert.equal(ids.includes("quiz"), false);
  assert.equal(rules.officialComponentRule?.verificationStatus, "SOURCE_REQUIRED");
  assert.deepEqual(rules.officialComponentRule?.components, []);
  assert.equal(rules.officialComponentRule?.source, null);
});
