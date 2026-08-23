import { practicalQuestionFamilies, questionFamilyDefinition } from "./profiles.ts";
import type {
  BlueprintForValidation,
  BlueprintInput,
  BlueprintValidation,
  BlueprintValidationIssue,
  QuestionFamily,
} from "./types.ts";

const MAX_MARKS = 300;
const MAX_DURATION_MINUTES = 360;

const LANGUAGE_COMPONENT_FAMILIES: Readonly<
  Record<string, ReadonlySet<QuestionFamily>>
> = {
  "101/1": new Set(["functional_communication"]),
  "101/2": new Set([
    "comprehension",
    "literary_appreciation",
    "grammar_language_use",
  ]),
  "101/3": new Set(["creative_composition", "set_text_response"]),
  "102/1": new Set(["insha"]),
  "102/2": new Set(["lugha"]),
  "102/3": new Set(["fasihi"]),
};

function issue(
  code: string,
  severity: "ERROR" | "WARNING",
  message: string,
  evidenceStatus: BlueprintValidationIssue["evidenceStatus"] =
    "APPLICATION_HEURISTIC"
): BlueprintValidationIssue {
  return { code, severity, message, evidenceStatus };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function validateBlueprintInput(
  input: BlueprintInput
): BlueprintValidationIssue[] {
  const issues: BlueprintValidationIssue[] = [];

  if (
    !Number.isInteger(input.totalMarks) ||
    input.totalMarks < 1 ||
    input.totalMarks > MAX_MARKS
  ) {
    issues.push(
      issue(
        "INVALID_MARKS",
        "ERROR",
        `Total marks must be a whole number between 1 and ${MAX_MARKS}.`
      )
    );
  }

  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 1 ||
    input.durationMinutes > MAX_DURATION_MINUTES
  ) {
    issues.push(
      issue(
        "INVALID_DURATION",
        "ERROR",
        `Duration must be a whole number between 1 and ${MAX_DURATION_MINUTES} minutes.`
      )
    );
  }

  if (!input.allowedExamStructures.includes(input.examStructure)) {
    issues.push(
      issue(
        "INVALID_EXAM_STRUCTURE",
        "ERROR",
        "The selected exam structure is not available for this canonical context."
      )
    );
  }

  if (input.examStructure === "standard" && input.component) {
    issues.push(
      issue(
        "INVALID_COMPONENT",
        "ERROR",
        "A Standard School Exam cannot include a KCSE-style component."
      )
    );
  }

  if ((input.examStructure === "kcse_style" || input.examStructure === "kjsea_style") && !input.component) {
    issues.push(
      issue(
        "COMPONENT_REQUIRED",
        "ERROR",
        "A canonical verified component is required for national-style planning."
      )
    );
  }

  if (
    input.component &&
    !input.allowedComponentIds.includes(input.component.id)
  ) {
    issues.push(
      issue(
        "INVALID_COMPONENT",
        "ERROR",
        "The selected component is not valid for this canonical assessment context."
      )
    );
  }

  const isGrade = /^Grade\s+[1-9]$/i.test(input.gradeName);
  const isForm = /^Form\s+[1-4]$/i.test(input.gradeName);
  if (
    (input.educationSystem === "CBC" && !isGrade) ||
    (input.educationSystem === "8-4-4" && !isForm)
  ) {
    issues.push(
      issue(
        "CONTEXT_MISMATCH",
        "ERROR",
        "The education system and Grade/Form context do not match."
      )
    );
  }

  if (input.curriculum.length === 0) {
    issues.push(
      issue(
        "EMPTY_CURRICULUM",
        "ERROR",
        "At least one canonical curriculum record is required."
      )
    );
  }

  const ids = input.curriculum.map((node) => node.curriculumId);
  if (new Set(ids).size !== ids.length) {
    issues.push(
      issue(
        "DUPLICATE_CURRICULUM",
        "ERROR",
        "The canonical curriculum selection contains duplicate records."
      )
    );
  }

  for (const node of input.curriculum) {
    if (!node.isActive) {
      issues.push(
        issue(
          "INACTIVE_CURRICULUM",
          "ERROR",
          `Inactive curriculum record ${node.curriculumId} cannot be planned.`,
          "OFFICIAL_CONSTRAINT"
        )
      );
    }
    if (node.gradeId !== input.gradeId) {
      issues.push(
        issue(
          "FOREIGN_GRADE_CURRICULUM",
          "ERROR",
          `Curriculum record ${node.curriculumId} belongs to another Grade/Form.`,
          "OFFICIAL_CONSTRAINT"
        )
      );
    }
    if (node.subjectId !== input.subjectId) {
      issues.push(
        issue(
          "FOREIGN_SUBJECT_CURRICULUM",
          "ERROR",
          `Curriculum record ${node.curriculumId} belongs to another subject.`,
          "OFFICIAL_CONSTRAINT"
        )
      );
    }
  }

  return issues;
}

export function validateExamBlueprint(
  blueprint: BlueprintForValidation,
  input: BlueprintInput
): BlueprintValidation {
  const issues = validateBlueprintInput(input);
  const selectedCurriculumIds = new Set(
    input.curriculum.map((node) => node.curriculumId)
  );
  const sectionMarks = sum(blueprint.sections.map((section) => section.targetMarks));
  const slotMarks = sum(blueprint.questionSlots.map((slot) => slot.targetMarks));
  const topicAllocationMarks = sum(
    blueprint.topicAllocations.map((allocation) => allocation.targetMarks)
  );
  const difficultyPercent = sum(
    blueprint.cognitiveProfile.targets.map((target) => target.targetPercent)
  );
  const profile = input.assessmentProfile;

  if (blueprint.assessmentProfile.profileId !== profile.profileId) {
    issues.push(issue("ASSESSMENT_PROFILE_MISMATCH", "ERROR", "Blueprint assessment profile identity does not match the canonical server profile."));
  }
  if (profile.ruleStatus === "OFFICIAL_VERIFIED") {
    if (profile.paper.totalMarks !== input.totalMarks) {
      issues.push(issue("OFFICIAL_TOTAL_MISMATCH", "ERROR", "Official profile total marks cannot be overridden.", "OFFICIAL_CONSTRAINT"));
    }
    if (profile.paper.durationMinutes !== input.durationMinutes) {
      issues.push(issue("OFFICIAL_DURATION_MISMATCH", "ERROR", "Official profile duration cannot be overridden.", "OFFICIAL_CONSTRAINT"));
    }
    const ordered = [...profile.sections].sort((a, b) => a.order - b.order);
    ordered.forEach((expected, index) => {
      const actual = blueprint.sections[index];
      const slots = actual
        ? blueprint.questionSlots.filter((slot) => slot.sectionId === actual.id)
        : [];
      if (!actual || actual.id !== expected.id || (expected.marks !== null && actual.targetMarks !== expected.marks)) {
        issues.push(issue("OFFICIAL_SECTION_MISMATCH", "ERROR", `Official section ${expected.id} identity, order and marks must remain exact.`, "OFFICIAL_CONSTRAINT"));
      }
      if (expected.questionCount?.exact !== undefined && slots.length !== expected.questionCount.exact) {
        issues.push(issue("OFFICIAL_QUESTION_COUNT_MISMATCH", "ERROR", `Official section ${expected.id} requires exactly ${expected.questionCount.exact} question slots.`, "OFFICIAL_CONSTRAINT"));
      }
      for (const [family, count] of Object.entries(expected.fixedFamilyCounts ?? {})) {
        if (slots.filter((slot) => slot.questionFamily === family).length !== count) {
          issues.push(issue("OFFICIAL_FAMILY_COUNT_MISMATCH", "ERROR", `Official section ${expected.id} has an exact ${family} count.`, "OFFICIAL_CONSTRAINT"));
        }
      }
    });
    if (blueprint.sections.length !== ordered.length) {
      issues.push(issue("OFFICIAL_SECTION_COUNT_MISMATCH", "ERROR", "Official section count must remain exact.", "OFFICIAL_CONSTRAINT"));
    }
  }

  if (blueprint.sections.length === 0 || blueprint.questionSlots.length === 0) {
    issues.push(
      issue(
        "EMPTY_BLUEPRINT",
        "ERROR",
        "A blueprint must contain at least one section and one question slot."
      )
    );
  }

  if (sectionMarks !== input.totalMarks) {
    issues.push(
      issue(
        "SECTION_MARKS_MISMATCH",
        "ERROR",
        `Section marks total ${sectionMarks}, not the requested ${input.totalMarks}.`
      )
    );
  }

  if (slotMarks !== input.totalMarks) {
    issues.push(
      issue(
        "SLOT_MARKS_MISMATCH",
        "ERROR",
        `Question-slot marks total ${slotMarks}, not the requested ${input.totalMarks}.`
      )
    );
  }

  if (topicAllocationMarks !== input.totalMarks) {
    issues.push(
      issue(
        "TOPIC_MARKS_MISMATCH",
        "ERROR",
        `Curriculum allocation marks total ${topicAllocationMarks}, not the requested ${input.totalMarks}.`
      )
    );
  }

  const slotsBySection = new Map<string, typeof blueprint.questionSlots>();
  for (const slot of blueprint.questionSlots) {
    const current = slotsBySection.get(slot.sectionId) ?? [];
    current.push(slot);
    slotsBySection.set(slot.sectionId, current);

    if (slot.targetMarks <= 0) {
      issues.push(
        issue(
          "NON_POSITIVE_SLOT",
          "ERROR",
          `Question slot ${slot.id} must have positive marks.`
        )
      );
    }
    if (
      slot.curriculumTargetIds.length === 0 ||
      slot.curriculumTargetIds.some((id) => !selectedCurriculumIds.has(id))
    ) {
      issues.push(
        issue(
          "INVALID_SLOT_CURRICULUM",
          "ERROR",
          `Question slot ${slot.id} must target only selected canonical curriculum.`
        )
      );
    }

    const family = questionFamilyDefinition(slot.questionFamily);
    if (
      slot.targetMarks < family.minimumSensibleMarks ||
      slot.targetMarks > family.maximumSensibleMarks
    ) {
      issues.push(
        issue(
          "MARK_SIZE_MISMATCH",
          "WARNING",
          `${slot.questionFamilyLabel} slot ${slot.id} has ${slot.targetMarks} marks; teacher review is required.`
        )
      );
    }
  }

  for (const section of blueprint.sections) {
    const sectionSlots = slotsBySection.get(section.id) ?? [];
    const sectionSlotMarks = sum(sectionSlots.map((slot) => slot.targetMarks));
    if (section.targetMarks <= 0) {
      issues.push(
        issue(
          "NON_POSITIVE_SECTION",
          "ERROR",
          `Section ${section.id} must have positive marks.`
        )
      );
    }
    if (sectionSlots.length === 0) {
      issues.push(
        issue(
          "ZERO_QUESTION_SECTION",
          "ERROR",
          `Section ${section.id} must contain at least one question slot.`
        )
      );
    }
    if (sectionSlotMarks !== section.targetMarks) {
      issues.push(
        issue(
          "SECTION_SLOT_MARKS_MISMATCH",
          "ERROR",
          `Slots in ${section.label} total ${sectionSlotMarks}, not ${section.targetMarks}.`
        )
      );
    }
  }

  const allocationIds = blueprint.topicAllocations.map(
    (allocation) => allocation.curriculumId
  );
  if (
    allocationIds.length !== selectedCurriculumIds.size ||
    new Set(allocationIds).size !== allocationIds.length ||
    allocationIds.some((id) => !selectedCurriculumIds.has(id))
  ) {
    issues.push(
      issue(
        "CURRICULUM_SCOPE_MISMATCH",
        "ERROR",
        "Topic allocations must represent exactly the selected canonical curriculum records."
      )
    );
  }

  if (
    difficultyPercent !== 100 ||
    sum(blueprint.cognitiveProfile.targets.map((target) => target.targetMarks)) !==
      input.totalMarks ||
    sum(blueprint.cognitiveProfile.targets.map((target) => target.plannedMarks)) !==
      input.totalMarks
  ) {
    issues.push(
      issue(
        "COGNITIVE_TARGET_MISMATCH",
        "ERROR",
        "Cognitive percentages must total 100 and cognitive marks must reconcile."
      )
    );
  }

  if (
    !Number.isFinite(blueprint.estimatedCompletionMinutes) ||
    blueprint.estimatedCompletionMinutes <= 0
  ) {
    issues.push(
      issue(
        "INVALID_TIME_ESTIMATE",
        "ERROR",
        "The blueprint must contain a positive application time estimate."
      )
    );
  }

  const practicalFamilies = practicalQuestionFamilies();
  const containsPractical = blueprint.questionSlots.some((slot) =>
    practicalFamilies.has(slot.questionFamily)
  );
  if (input.component?.componentType === "PRACTICAL") {
    if (
      !blueprint.profileId.startsWith("science-practical-") ||
      blueprint.questionSlots.some(
        (slot) => !practicalFamilies.has(slot.questionFamily)
      )
    ) {
      issues.push(
        issue(
          "PRACTICAL_PROFILE_MISMATCH",
          "ERROR",
          "A practical component must use only practical-oriented blueprint slots."
        )
      );
    }
  } else if (containsPractical) {
    issues.push(
      issue(
        "THEORY_PROFILE_MISMATCH",
        "ERROR",
        "A written or standard assessment cannot use KCSE practical slots."
      )
    );
  }

  const allowedLanguageFamilies = input.component
    ? LANGUAGE_COMPONENT_FAMILIES[input.component.paperCode]
    : null;
  if (
    allowedLanguageFamilies &&
    blueprint.questionSlots.some(
      (slot) => !allowedLanguageFamilies.has(slot.questionFamily)
    )
  ) {
    issues.push(
      issue(
        "LANGUAGE_COMPONENT_PROFILE_MISMATCH",
        "ERROR",
        `${input.component!.paperCode} contains a question family from another language component.`
      )
    );
  }

  if (
    (input.component === null) !== (blueprint.component === null) ||
    (input.component && blueprint.component?.id !== input.component.id)
  ) {
    issues.push(
      issue(
        "COMPONENT_IDENTITY_MISMATCH",
        "ERROR",
        "Blueprint component identity does not match the canonical component."
      )
    );
  }

  const intentKeys = new Set<string>();
  let duplicateIntent = false;
  for (const slot of blueprint.questionSlots) {
    const key = `${slot.curriculumTargetIds.join(",")}|${slot.questionFamily}|${slot.cognitiveDemand}`;
    if (intentKeys.has(key)) duplicateIntent = true;
    intentKeys.add(key);
  }
  if (duplicateIntent) {
    issues.push(
      issue(
        "DUPLICATE_COVERAGE_RISK",
        "WARNING",
        "Some planned slots share the same curriculum, family and cognitive demand; review for unnecessary repetition."
      )
    );
  }

  if (blueprint.timeFit.status === "WARNING_TIME_PRESSURE") {
    issues.push(
      issue(
        "WARNING_TIME_PRESSURE",
        "WARNING",
        "The application estimate is high for the teacher-selected duration."
      )
    );
  }
  if (blueprint.timeFit.status === "WARNING_TOO_LIGHT") {
    issues.push(
      issue(
        "WARNING_TOO_LIGHT",
        "WARNING",
        "The application estimate is light for the teacher-selected duration."
      )
    );
  }

  const errors = issues.filter((candidate) => candidate.severity === "ERROR");
  const warnings = issues.filter(
    (candidate) => candidate.severity === "WARNING"
  );

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    reconciliation: {
      requestedMarks: input.totalMarks,
      sectionMarks,
      slotMarks,
      topicAllocationMarks,
      difficultyPercent,
    },
    timeFitStatus: blueprint.timeFit.status,
  };
}
