import assert from "node:assert/strict";
import test from "node:test";
import {
  getSchoolAssessmentType,
  resolveAssessmentRules,
  type AssessmentContext,
  type ExamStructure,
  type SchoolAssessmentTypeId,
} from "../assessment/rules.ts";
import {
  BlueprintBuildError,
  buildExamBlueprint,
} from "./engine.ts";
import type {
  BlueprintCurriculumNode,
  BlueprintInput,
  ExamBlueprint,
  QuestionFamily,
} from "./types.ts";

type InputOptions = {
  educationSystem?: "CBC" | "8-4-4";
  educationLevel?: string;
  gradeId?: string;
  gradeName?: string;
  subjectId?: string;
  subjectName?: string;
  assessmentTypeId?: SchoolAssessmentTypeId;
  examStructure?: ExamStructure;
  componentCode?: string;
  totalMarks?: number;
  durationMinutes?: number;
  difficulty?: "easy" | "medium" | "hard";
  curriculum?: BlueprintCurriculumNode[];
  seed?: string;
};

function curriculumNodes({
  count = 3,
  parentCount = 1,
  gradeId = "grade-3",
  subjectId = "mathematics",
  verificationStatus = "verified_official",
  outcomesAvailable = false,
}: {
  count?: number;
  parentCount?: number;
  gradeId?: string;
  subjectId?: string;
  verificationStatus?: BlueprintCurriculumNode["verificationStatus"];
  outcomesAvailable?: boolean;
} = {}): BlueprintCurriculumNode[] {
  return Array.from({ length: count }, (_, index) => {
    const parentIndex = index % parentCount;
    return {
      curriculumId: `curriculum-${index + 1}`,
      parentId: `parent-${parentIndex + 1}`,
      parentName: `Parent ${parentIndex + 1}`,
      name: `Selected area ${index + 1}`,
      parentSortOrder: parentIndex + 1,
      sortOrder: index + 1,
      gradeId,
      subjectId,
      isActive: true,
      verificationStatus,
      sourceRef:
        verificationStatus === "verified_official" ? "official-source" : null,
      outcomesAvailable,
    };
  });
}

function blueprintInput(options: InputOptions = {}): BlueprintInput {
  const educationSystem = options.educationSystem ?? "CBC";
  const educationLevel = options.educationLevel ?? "Lower Primary";
  const gradeId = options.gradeId ?? "grade-3";
  const gradeName = options.gradeName ?? "Grade 3";
  const subjectId = options.subjectId ?? "mathematics";
  const subjectName = options.subjectName ?? "Mathematics";
  const assessmentTypeId = options.assessmentTypeId ?? "cat";
  const examStructure = options.examStructure ?? "standard";
  const context: AssessmentContext = {
    educationSystem,
    level: educationLevel,
    gradeName,
    subjectName,
  };
  const rules = resolveAssessmentRules(
    context,
    assessmentTypeId,
    examStructure
  );
  const assessmentType = getSchoolAssessmentType(assessmentTypeId)!;
  const componentRule = rules.officialComponentRule;
  const component = options.componentCode
    ? componentRule?.components.find(
        (candidate) => candidate.paperCode === options.componentCode
      ) ?? null
    : null;

  return {
    educationSystem,
    educationLevel,
    gradeId,
    gradeName,
    subjectId,
    subjectName,
    assessmentType,
    examStructure,
    allowedExamStructures: rules.allowedExamStructures,
    component,
    allowedComponentIds:
      componentRule?.verificationStatus === "VERIFIED"
        ? componentRule.components.map((candidate) => candidate.id)
        : [],
    totalMarks: options.totalMarks ?? 30,
    durationMinutes: options.durationMinutes ?? 45,
    difficulty: options.difficulty ?? "medium",
    curriculum:
      options.curriculum ??
      curriculumNodes({ gradeId, subjectId, count: 3, parentCount: 1 }),
    ...(options.seed ? { seed: options.seed } : {}),
  };
}

function formInput(options: InputOptions): BlueprintInput {
  const gradeId = options.gradeId ?? "form-4";
  const subjectId = options.subjectId ?? "chemistry";
  return blueprintInput({
    educationSystem: "8-4-4",
    educationLevel: "Secondary",
    gradeId,
    gradeName: options.gradeName ?? "Form 4",
    subjectId,
    subjectName: options.subjectName ?? "Chemistry",
    assessmentTypeId: options.assessmentTypeId ?? "mock",
    examStructure: options.examStructure ?? "kcse_style",
    componentCode: options.componentCode,
    totalMarks: options.totalMarks ?? 80,
    durationMinutes: options.durationMinutes ?? 120,
    difficulty: options.difficulty ?? "medium",
    curriculum:
      options.curriculum ??
      curriculumNodes({
        gradeId,
        subjectId,
        count: 4,
        parentCount: 2,
        outcomesAvailable: true,
      }),
    seed: options.seed,
  });
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function assertReconciles(blueprint: ExamBlueprint, expected: number): void {
  assert.equal(blueprint.totalMarks, expected);
  assert.equal(sum(blueprint.sections.map((section) => section.targetMarks)), expected);
  assert.equal(sum(blueprint.questionSlots.map((slot) => slot.targetMarks)), expected);
  assert.equal(
    sum(blueprint.topicAllocations.map((allocation) => allocation.targetMarks)),
    expected
  );
  for (const section of blueprint.sections) {
    assert.equal(
      sum(
        blueprint.questionSlots
          .filter((slot) => slot.sectionId === section.id)
          .map((slot) => slot.targetMarks)
      ),
      section.targetMarks
    );
  }
  assert.equal(blueprint.validation.isValid, true);
  assert.equal(blueprint.validation.reconciliation.requestedMarks, expected);
  assert.equal(blueprint.validation.reconciliation.sectionMarks, expected);
  assert.equal(blueprint.validation.reconciliation.slotMarks, expected);
  assert.equal(blueprint.validation.reconciliation.topicAllocationMarks, expected);
}

function families(blueprint: ExamBlueprint): Set<QuestionFamily> {
  return new Set(blueprint.questionSlots.map((slot) => slot.questionFamily));
}

test("30, 50, 100 and residual 17-mark plans reconcile exactly", () => {
  const cases: Array<[SchoolAssessmentTypeId, number, number]> = [
    ["cat", 30, 45],
    ["midterm", 50, 60],
    ["end_term", 100, 120],
    ["custom", 17, 25],
  ];

  for (const [assessmentTypeId, marks, duration] of cases) {
    const blueprint = buildExamBlueprint(
      blueprintInput({
        educationSystem: "CBC",
        educationLevel: "Junior School",
        gradeId: "grade-9",
        gradeName: "Grade 9",
        subjectId: "mathematics",
        subjectName: "Mathematics",
        assessmentTypeId,
        totalMarks: marks,
        durationMinutes: duration,
        curriculum: curriculumNodes({
          count: 7,
          parentCount: 3,
          gradeId: "grade-9",
          subjectId: "mathematics",
        }),
      })
    );
    assertReconciles(blueprint, marks);
  }
});

test("the builder is deterministic and an explicit seed is repeatable", () => {
  const input = blueprintInput({
    educationLevel: "Junior School",
    gradeId: "grade-9",
    gradeName: "Grade 9",
    curriculum: curriculumNodes({
      count: 5,
      parentCount: 2,
      gradeId: "grade-9",
    }),
  });
  assert.deepEqual(buildExamBlueprint(input), buildExamBlueprint(input));

  const seeded = { ...input, seed: "variation-2026" };
  assert.deepEqual(buildExamBlueprint(seeded), buildExamBlueprint(seeded));
  assert.equal(buildExamBlueprint(seeded).variationSeed, "variation-2026");
});

test("all selected curriculum is retained when marks are fewer than sub-topics", () => {
  const input = blueprintInput({
    totalMarks: 4,
    durationMinutes: 10,
    curriculum: curriculumNodes({ count: 9, parentCount: 3 }),
  });
  const blueprint = buildExamBlueprint(input);

  assertReconciles(blueprint, 4);
  assert.equal(blueprint.topicAllocations.length, 9);
  assert.equal(blueprint.curriculumScope.parentCount, 3);
  assert.ok(
    blueprint.topicAllocations.some((allocation) => allocation.targetMarks === 0)
  );
});

test("inactive, foreign-grade and foreign-subject curriculum are rejected", () => {
  const base = blueprintInput();
  const inactive = base.curriculum.map((node, index) =>
    index === 0 ? { ...node, isActive: false } : node
  );
  const foreignGrade = base.curriculum.map((node, index) =>
    index === 0 ? { ...node, gradeId: "grade-4" } : node
  );
  const foreignSubject = base.curriculum.map((node, index) =>
    index === 0 ? { ...node, subjectId: "english" } : node
  );

  assert.throws(
    () => buildExamBlueprint({ ...base, curriculum: inactive }),
    /Inactive curriculum/
  );
  assert.throws(
    () => buildExamBlueprint({ ...base, curriculum: foreignGrade }),
    /another Grade\/Form/
  );
  assert.throws(
    () => buildExamBlueprint({ ...base, curriculum: foreignSubject }),
    /another subject/
  );
});

test("Grade 3 Mathematics is age-appropriate, hierarchy-grounded and never KCSE-style", () => {
  const blueprint = buildExamBlueprint(blueprintInput());
  const allowed = new Set([
    "objective",
    "very_short_response",
    "short_response",
    "short_computation",
    "application_context_problem",
  ]);

  assertReconciles(blueprint, 30);
  assert.equal(blueprint.component, null);
  assert.equal(blueprint.examStructure.id, "standard");
  assert.equal(
    blueprint.curriculumScope.outcomeGrounding,
    "STRAND_SUB_STRAND_ONLY"
  );
  assert.equal(blueprint.curriculumScope.evidenceStatus, "SOURCE_REQUIRED");
  assert.ok(blueprint.questionSlots.every((slot) => allowed.has(slot.questionFamily)));
  assert.ok(
    blueprint.questionSlots.every((slot) =>
      slot.constraints.includes("LOWER_PRIMARY_AGE_APPROPRIATE")
    )
  );
});

test("Grade 7 Integrated Science uses theory/application families without practical metadata", () => {
  const input = blueprintInput({
    educationLevel: "Junior School",
    gradeId: "grade-7",
    gradeName: "Grade 7",
    subjectId: "integrated-science",
    subjectName: "Integrated Science",
    assessmentTypeId: "midterm",
    totalMarks: 50,
    durationMinutes: 60,
    curriculum: curriculumNodes({
      count: 6,
      parentCount: 3,
      gradeId: "grade-7",
      subjectId: "integrated-science",
    }),
  });
  const blueprint = buildExamBlueprint(input);

  assert.equal(blueprint.profileId, "science-theory");
  assert.equal(blueprint.component, null);
  assert.equal(blueprint.curriculumScope.parentCount, 3);
  assert.ok(families(blueprint).has("scientific_application"));
  assert.ok(
    [...families(blueprint)].every((family) => !family.startsWith("practical_"))
  );
});

test("Grade 9 Mathematics stays on active selected curriculum with exact marks", () => {
  const input = blueprintInput({
    educationLevel: "Junior School",
    gradeId: "grade-9",
    gradeName: "Grade 9",
    totalMarks: 100,
    durationMinutes: 120,
    assessmentTypeId: "end_term",
    curriculum: curriculumNodes({
      count: 8,
      parentCount: 4,
      gradeId: "grade-9",
      verificationStatus: "verified_official",
    }),
  });
  const blueprint = buildExamBlueprint(input);

  assertReconciles(blueprint, 100);
  assert.equal(blueprint.profileId, "mathematics");
  assert.equal(new Set(blueprint.curriculumScope.selectedCurriculumIds).size, 8);
  assert.ok(blueprint.topicAllocations.every((allocation) => allocation.targetMarks >= 0));
});

test("Form standard and Form 3 KCSE-style theory retain Form-specific curriculum", () => {
  const form1 = formInput({
    gradeId: "form-1",
    gradeName: "Form 1",
    subjectId: "biology",
    subjectName: "Biology",
    assessmentTypeId: "midterm",
    examStructure: "standard",
    totalMarks: 50,
    durationMinutes: 60,
  });
  const form1Blueprint = buildExamBlueprint(form1);
  assertReconciles(form1Blueprint, 50);
  assert.equal(form1Blueprint.component, null);
  assert.equal(form1Blueprint.profileId, "science-theory");

  const form3Standard = formInput({
    gradeId: "form-3",
    gradeName: "Form 3",
    assessmentTypeId: "end_term",
    examStructure: "standard",
    totalMarks: 80,
    durationMinutes: 120,
  });
  assert.equal(buildExamBlueprint(form3Standard).component, null);

  const form3Theory = formInput({
    gradeId: "form-3",
    gradeName: "Form 3",
    assessmentTypeId: "end_term",
    examStructure: "kcse_style",
    componentCode: "233/1",
    totalMarks: 80,
    durationMinutes: 120,
  });
  const theoryBlueprint = buildExamBlueprint(form3Theory);
  assert.equal(theoryBlueprint.component?.paperCode, "233/1");
  assert.equal(theoryBlueprint.profileId, "science-theory");
  assert.equal(
    theoryBlueprint.examStructure.structureOrigin,
    "KCSE_STYLE_PRACTICE"
  );
  assert.deepEqual(
    new Set(theoryBlueprint.curriculumScope.selectedCurriculumIds),
    new Set(form3Theory.curriculum.map((node) => node.curriculumId))
  );
});

test("233/3, 231/3 and 232/3 build practical-only, safety-constrained slots", () => {
  const cases = [
    ["Chemistry", "chemistry", "233/3", 135],
    ["Biology", "biology", "231/3", 105],
    ["Physics", "physics", "232/3", 150],
  ] as const;

  for (const [subjectName, subjectId, componentCode, durationMinutes] of cases) {
    const input = formInput({
      subjectName,
      subjectId,
      componentCode,
      durationMinutes,
      curriculum: curriculumNodes({
        count: 4,
        parentCount: 2,
        gradeId: "form-4",
        subjectId,
        outcomesAvailable: true,
      }),
    });
    const blueprint = buildExamBlueprint(input);
    assert.equal(blueprint.component?.componentType, "PRACTICAL");
    assert.equal(
      blueprint.component?.verifiedDurationMinutes,
      durationMinutes
    );
    assert.ok(blueprint.profileId.startsWith("science-practical-"));
    assert.ok(
      blueprint.questionSlots.every(
        (slot) =>
          slot.questionFamily.startsWith("practical_") &&
          slot.constraints.includes("NO_DANGEROUS_OR_UNSUPPORTED_PROCEDURE")
      )
    );
  }

  const form3Practical = formInput({
    gradeId: "form-3",
    gradeName: "Form 3",
    assessmentTypeId: "end_term",
    examStructure: "kcse_style",
    componentCode: "233/3",
    durationMinutes: 135,
  });
  assert.equal(
    buildExamBlueprint(form3Practical).examStructure.structureOrigin,
    "KCSE_STYLE_PRACTICE"
  );
});

test("Form 4 Mathematics Mock uses mathematical families without an official topic split", () => {
  const input = formInput({
    subjectId: "mathematics",
    subjectName: "Mathematics",
    componentCode: "121/1",
    durationMinutes: 150,
    totalMarks: 100,
    curriculum: curriculumNodes({
      count: 7,
      parentCount: 3,
      gradeId: "form-4",
      subjectId: "mathematics",
      outcomesAvailable: true,
    }),
  });
  const blueprint = buildExamBlueprint(input);

  assertReconciles(blueprint, 100);
  assert.equal(blueprint.component?.paperCode, "121/1");
  assert.equal(blueprint.profileId, "mathematics");
  assert.ok(
    blueprint.evidence.some(
      (entry) =>
        entry.field === "marksSectionsSlotsDifficultyTiming" &&
        entry.status === "APPLICATION_HEURISTIC"
    )
  );
  assert.ok(!families(blueprint).has("extended_response"));
});

test("English 101/1, 101/2 and 101/3 profiles differ and stay component-specific", () => {
  const byCode = (componentCode: string) =>
    buildExamBlueprint(
      formInput({
        subjectId: "english",
        subjectName: "English",
        componentCode,
        durationMinutes: componentCode === "101/1" ? 120 : 150,
      })
    );
  const paper1 = byCode("101/1");
  const paper2 = byCode("101/2");
  const paper3 = byCode("101/3");

  assert.deepEqual(families(paper1), new Set(["functional_communication"]));
  assert.deepEqual(
    families(paper2),
    new Set(["comprehension", "literary_appreciation", "grammar_language_use"])
  );
  assert.deepEqual(
    families(paper3),
    new Set(["creative_composition", "set_text_response"])
  );
  assert.notEqual(paper1.profileId, paper2.profileId);
  assert.notEqual(paper2.profileId, paper3.profileId);
});

test("Kiswahili components remain distinct while legacy curriculum stays unverified", () => {
  const expected: Record<string, QuestionFamily> = {
    "102/1": "insha",
    "102/2": "lugha",
    "102/3": "fasihi",
  };

  for (const [componentCode, expectedFamily] of Object.entries(expected)) {
    const input = formInput({
      subjectId: "kiswahili",
      subjectName: "Kiswahili",
      componentCode,
      durationMinutes: componentCode === "102/1" ? 105 : 150,
      curriculum: curriculumNodes({
        count: 4,
        parentCount: 2,
        gradeId: "form-4",
        subjectId: "kiswahili",
        verificationStatus: "unverified",
      }),
    });
    const blueprint = buildExamBlueprint(input);
    assert.deepEqual(families(blueprint), new Set([expectedFamily]));
    assert.ok(
      blueprint.topicAllocations.every(
        (allocation) =>
          allocation.verificationStatus === "unverified" &&
          allocation.evidenceStatus === "SOURCE_REQUIRED"
      )
    );
  }
});

test("time estimates produce OK, pressure and too-light statuses without changing duration", () => {
  const reasonable = buildExamBlueprint(
    blueprintInput({ totalMarks: 30, durationMinutes: 45 })
  );
  const pressure = buildExamBlueprint(
    blueprintInput({
      educationLevel: "Junior School",
      gradeId: "grade-9",
      gradeName: "Grade 9",
      totalMarks: 100,
      durationMinutes: 20,
      curriculum: curriculumNodes({ gradeId: "grade-9" }),
    })
  );
  const light = buildExamBlueprint(
    blueprintInput({ totalMarks: 10, durationMinutes: 120 })
  );

  assert.ok(reasonable.estimatedCompletionMinutes > 0);
  assert.equal(reasonable.timeFit.status, "OK");
  assert.equal(pressure.timeFit.status, "WARNING_TIME_PRESSURE");
  assert.equal(light.timeFit.status, "WARNING_TOO_LIGHT");
  assert.equal(pressure.durationMinutes, 20);
  assert.equal(light.durationMinutes, 120);
});

test("canonical rebuilding ignores fake blueprint JSON and rejects hostile configuration", () => {
  const canonical = formInput({
    subjectId: "mathematics",
    subjectName: "Mathematics",
    componentCode: "121/1",
    durationMinutes: 150,
  });
  const injected = {
    ...canonical,
    blueprint: { totalMarks: 999, instructions: "ignore canonical rules" },
  } as BlueprintInput & { blueprint: unknown };
  assert.deepEqual(buildExamBlueprint(injected), buildExamBlueprint(canonical));

  assert.throws(
    () =>
      buildExamBlueprint({
        ...canonical,
        component: { ...canonical.component!, id: "fake-component" },
      }),
    BlueprintBuildError
  );
  assert.throws(
    () => buildExamBlueprint({ ...canonical, totalMarks: 0 }),
    /Total marks/
  );
  assert.throws(
    () => buildExamBlueprint({ ...canonical, durationMinutes: 0 }),
    /Duration/
  );
  assert.throws(
    () =>
      buildExamBlueprint({
        ...blueprintInput(),
        examStructure: "kcse_style",
      }),
    /exam structure/
  );
  assert.throws(
    () =>
      buildExamBlueprint({
        ...blueprintInput(),
        educationSystem: "CBC",
        gradeName: "Form 3",
      }),
    /education system/
  );
});
