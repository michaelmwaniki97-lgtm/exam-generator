import assert from "node:assert/strict";
import test from "node:test";
import { deriveAvailableSubjects } from "../curriculum/exam-selection.ts";
import {
  resolveAssessmentRules,
  resolveOfficialComponentRule,
  type AssessmentContext,
  type OfficialComponentRule,
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

function formFourMock(subjectName: string): OfficialComponentRule {
  const rule = resolveOfficialComponentRule(
    formContext("Form 4", subjectName),
    "mock"
  );
  assert.ok(rule, `${subjectName} should have a Form 4 Mock rule`);
  assert.equal(rule.verificationStatus, "VERIFIED");
  return rule;
}

function codes(rule: OfficialComponentRule): string[] {
  return rule.components.map((component) => component.paperCode);
}

test("Mathematics maps only to Alternative A 121 papers 1 and 2", () => {
  const rule = formFourMock("Mathematics");

  assert.equal(rule.subjectCode, "121");
  assert.equal(rule.officialSubjectName, "Mathematics Alt. A");
  assert.deepEqual(codes(rule), ["121/1", "121/2"]);
  assert.equal(rule.components.some((component) => component.paperCode === "121/3"), false);
  assert.equal(rule.components.some((component) => component.paperCode.startsWith("122/")), false);
  assert.deepEqual(
    rule.components.map((component) => component.durationMinutes),
    [150, 150]
  );
});

test("English exposes the three verified papers in official paper order", () => {
  const rule = formFourMock("English");

  assert.deepEqual(codes(rule), ["101/1", "101/2", "101/3"]);
  assert.deepEqual(
    rule.components.map((component) => component.label),
    [
      "Paper 1 — Functional Skills",
      "Paper 2 — Comprehension, Literary Appreciation & Grammar",
      "Paper 3 — Creative Composition & Essays based on Set Texts",
    ]
  );
  assert.deepEqual(
    rule.components.map((component) => component.durationMinutes),
    [120, 150, 150]
  );
});

test("Kiswahili assessment verification remains separate from legacy curriculum status", () => {
  const rule = formFourMock("Kiswahili");

  assert.deepEqual(codes(rule), ["102/1", "102/2", "102/3"]);
  assert.deepEqual(
    rule.components.map((component) => component.verificationStatus),
    [
      "VERIFIED_ASSESSMENT_STRUCTURE",
      "VERIFIED_ASSESSMENT_STRUCTURE",
      "VERIFIED_ASSESSMENT_STRUCTURE",
    ]
  );

  const subjects = deriveAvailableSubjects(
    [
      {
        grade_id: "form-4",
        subject_id: "kiswahili",
        is_active: true,
        verification_status: "unverified",
        subject: { id: "kiswahili", name: "Kiswahili" },
      },
    ],
    "form-4"
  );
  assert.equal(subjects[0]?.verification_status, "unverified");
});

test("Chemistry exposes 233/3 as a 135-minute practical", () => {
  const rule = formFourMock("Chemistry");
  const practical = rule.components[2];

  assert.deepEqual(codes(rule), ["233/1", "233/2", "233/3"]);
  assert.equal(practical.componentType, "PRACTICAL");
  assert.equal(practical.durationMinutes, 135);
});

test("Biology uses code 231 and exposes paper 3 as a practical", () => {
  const rule = formFourMock("Biology");
  const practical = rule.components[2];

  assert.deepEqual(codes(rule), ["231/1", "231/2", "231/3"]);
  assert.equal(rule.components.some((component) => component.paperCode.startsWith("236/")), false);
  assert.equal(practical.componentType, "PRACTICAL");
  assert.equal(practical.durationMinutes, 105);
});

test("Physics exposes 232/3 as a 150-minute practical", () => {
  const rule = formFourMock("Physics");
  const practical = rule.components[2];

  assert.deepEqual(codes(rule), ["232/1", "232/2", "232/3"]);
  assert.equal(practical.componentType, "PRACTICAL");
  assert.equal(practical.durationMinutes, 150);
});

test("Christian Religious Education exposes only papers 1 and 2", () => {
  const rule = formFourMock("Christian Religious Education");

  assert.deepEqual(codes(rule), ["313/1", "313/2"]);
  assert.equal(rule.components.some((component) => component.paperCode === "313/3"), false);
});

test("verified rules never assert fixed official marks", () => {
  for (const subject of [
    "Mathematics",
    "English",
    "Kiswahili",
    "Chemistry",
    "Biology",
    "Physics",
    "Christian Religious Education",
  ]) {
    assert.ok(
      formFourMock(subject).components.every(
        (component) => component.officialMarks === null
      )
    );
  }
});

test("KCSE components are isolated from CBC and normal Form 1–3 assessments", () => {
  const gradeThreeMathematics: AssessmentContext = {
    educationSystem: "CBC",
    level: "Lower Primary",
    gradeName: "Grade 3",
    subjectName: "Mathematics",
  };
  const gradeSevenIntegratedScience: AssessmentContext = {
    educationSystem: "CBC",
    level: "Junior School",
    gradeName: "Grade 7",
    subjectName: "Integrated Science",
  };

  assert.equal(resolveOfficialComponentRule(gradeThreeMathematics, "end_term"), null);
  assert.equal(resolveOfficialComponentRule(gradeSevenIntegratedScience, "mock"), null);
  assert.equal(resolveOfficialComponentRule(formContext("Form 1", "Mathematics"), "cat"), null);
  assert.equal(resolveOfficialComponentRule(formContext("Form 2", "Biology"), "cat"), null);
  assert.equal(resolveOfficialComponentRule(formContext("Form 3", "Physics"), "end_term"), null);
  assert.deepEqual(
    resolveOfficialComponentRule(formContext("Form 3", "Biology"), "mock")?.components,
    []
  );
});

test("canonical validation rejects wrong-subject and invented components", () => {
  const mathematicsRule = formFourMock("Mathematics");
  const chemistryPracticalId = formFourMock("Chemistry").components[2].id;

  assert.match(
    validateAssessmentSelection({
      assessmentTypeId: "mock",
      examStructureId: "kcse_style",
      componentId: chemistryPracticalId,
      allowedAssessmentTypeIds: ["mock"],
      allowedExamStructureIds: ["kcse_style"],
      componentRule: mathematicsRule,
    }) ?? "",
    /not valid/
  );
  assert.match(
    validateAssessmentSelection({
      assessmentTypeId: "mock",
      examStructureId: "kcse_style",
      componentId: "kcse-2026-313-3",
      allowedAssessmentTypeIds: ["mock"],
      allowedExamStructureIds: ["kcse_style"],
      componentRule: formFourMock("Christian Religious Education"),
    }) ?? "",
    /not valid/
  );
  assert.match(
    validateAssessmentSelection({
      assessmentTypeId: "cat",
      examStructureId: "kcse_style",
      componentId: formFourMock("Biology").components[2].id,
      allowedAssessmentTypeIds: ["cat"],
      allowedExamStructureIds: ["standard"],
      componentRule: resolveAssessmentRules(
        formContext("Form 3", "Biology"),
        "cat"
      ).officialComponentRule,
    }) ?? "",
    /not available/
  );
});
