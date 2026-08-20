import {
  questionFamilyDefinition,
  resolveSubjectBlueprintProfile,
  type ProfileGroup,
} from "./profiles.ts";
import {
  validateBlueprintInput,
  validateExamBlueprint,
} from "./validation.ts";
import {
  BLUEPRINT_VERSION,
  type BlueprintCurriculumNode,
  type BlueprintEvidence,
  type BlueprintForValidation,
  type BlueprintInput,
  type BlueprintSection,
  type BlueprintValidationIssue,
  type CognitiveDemand,
  type CognitiveTarget,
  type ExamBlueprint,
  type OutcomeGrounding,
  type QuestionFamily,
  type QuestionSlot,
  type QuestionTypeTarget,
  type StructureOrigin,
  type TimeFitStatus,
  type TopicAllocation,
} from "./types.ts";

const COGNITIVE_PERCENTAGES = {
  easy: { FOUNDATIONAL: 55, APPLICATION: 35, REASONING: 10 },
  medium: { FOUNDATIONAL: 35, APPLICATION: 45, REASONING: 20 },
  hard: { FOUNDATIONAL: 20, APPLICATION: 45, REASONING: 35 },
} as const;

const COGNITIVE_ORDER: CognitiveDemand[] = [
  "FOUNDATIONAL",
  "APPLICATION",
  "REASONING",
];

export class BlueprintBuildError extends Error {
  readonly issues: BlueprintValidationIssue[];

  constructor(issues: BlueprintValidationIssue[]) {
    super(issues[0]?.message ?? "The exam blueprint could not be built.");
    this.name = "BlueprintBuildError";
    this.issues = issues;
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function allocateIntegerMarks(
  total: number,
  weights: readonly number[]
): number[] {
  if (weights.length === 0) return [];
  const safeWeights = weights.map((weight) =>
    Number.isFinite(weight) && weight > 0 ? weight : 0
  );
  const weightTotal = sum(safeWeights);
  const normalized = weightTotal > 0 ? safeWeights : weights.map(() => 1);
  const normalizedTotal = sum(normalized);
  const exact = normalized.map((weight) => (total * weight) / normalizedTotal);
  const allocated = exact.map((value) => Math.floor(value));
  const residual = total - sum(allocated);
  const residualOrder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let index = 0; index < residual; index += 1) {
    allocated[residualOrder[index % residualOrder.length].index] += 1;
  }
  return allocated;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotation(input: BlueprintInput, length: number, salt: string): number {
  if (!input.seed || length <= 1) return 0;
  return stableHash(`${input.seed}:${salt}`) % length;
}

function rotate<T>(values: readonly T[], amount: number): T[] {
  if (values.length === 0 || amount === 0) return [...values];
  return [...values.slice(amount), ...values.slice(0, amount)];
}

function orderedCurriculum(input: BlueprintInput): BlueprintCurriculumNode[] {
  return [...input.curriculum].sort(
    (a, b) =>
      a.parentSortOrder - b.parentSortOrder ||
      a.sortOrder - b.sortOrder ||
      a.parentName.localeCompare(b.parentName) ||
      a.name.localeCompare(b.name) ||
      a.curriculumId.localeCompare(b.curriculumId)
  );
}

function sectionLimit(input: BlueprintInput, groupCount: number): number {
  if (input.component) return groupCount;
  if (input.educationLevel === "Lower Primary") return Math.min(2, groupCount);
  if (input.assessmentType.id === "quiz") return 1;
  if (
    input.assessmentType.id === "cat" ||
    input.assessmentType.id === "diagnostic_assessment"
  ) {
    return Math.min(input.totalMarks >= 20 ? 2 : 1, groupCount);
  }
  return groupCount;
}

function activeGroups(
  input: BlueprintInput,
  groups: readonly ProfileGroup[]
): ProfileGroup[] {
  const limited = groups.slice(0, sectionLimit(input, groups.length));
  return limited.slice(0, Math.max(1, Math.min(limited.length, input.totalMarks)));
}

function structureOrigin(input: BlueprintInput): StructureOrigin {
  if (input.examStructure === "standard") return "STANDARD_SCHOOL";
  if (input.gradeName === "Form 3") return "KCSE_STYLE_PRACTICE";
  if (input.gradeName === "Form 4" && input.assessmentType.id === "mock") {
    return "KCSE_STYLE_MOCK";
  }
  return "KCSE_STYLE_SCHOOL";
}

function outcomeGrounding(input: BlueprintInput): {
  value: OutcomeGrounding;
  evidenceStatus: "OFFICIAL_CONSTRAINT" | "SOURCE_REQUIRED";
} {
  const allHaveOutcomes = input.curriculum.every(
    (node) => node.outcomesAvailable
  );
  if (input.educationSystem === "CBC") {
    return allHaveOutcomes
      ? {
          value: "LEARNING_OUTCOMES_AVAILABLE",
          evidenceStatus: "OFFICIAL_CONSTRAINT",
        }
      : {
          value: "STRAND_SUB_STRAND_ONLY",
          evidenceStatus: "SOURCE_REQUIRED",
        };
  }
  return allHaveOutcomes
    ? {
        value: "TOPIC_OBJECTIVES_AVAILABLE",
        evidenceStatus: "OFFICIAL_CONSTRAINT",
      }
    : {
        value: "TOPIC_SUB_TOPIC_ONLY",
        evidenceStatus: "SOURCE_REQUIRED",
      };
}

function evidenceForCurriculum(
  node: BlueprintCurriculumNode
): "OFFICIAL_CONSTRAINT" | "SOURCE_REQUIRED" {
  return node.verificationStatus === "verified_official"
    ? "OFFICIAL_CONSTRAINT"
    : "SOURCE_REQUIRED";
}

function buildTopicAllocations(
  input: BlueprintInput,
  curriculum: readonly BlueprintCurriculumNode[],
  families: readonly QuestionFamily[]
): TopicAllocation[] {
  const parentCounts = new Map<string, number>();
  for (const node of curriculum) {
    parentCounts.set(node.parentId, (parentCounts.get(node.parentId) ?? 0) + 1);
  }
  const weights = curriculum.map(
    (node) => 1 / (parentCounts.get(node.parentId) ?? 1)
  );
  const marks = allocateIntegerMarks(input.totalMarks, weights);

  return curriculum.map((node, index) => ({
    curriculumId: node.curriculumId,
    parentId: node.parentId,
    parentName: node.parentName,
    displayName: node.name,
    targetMarks: marks[index],
    slotCount: 0,
    allowedQuestionTypes: [...families],
    verificationStatus: node.verificationStatus,
    evidenceStatus: evidenceForCurriculum(node),
    sourceRef: node.sourceRef,
  }));
}

type SlotDraft = Omit<
  QuestionSlot,
  "cognitiveDemand" | "curriculumTargetIds"
>;

function selectFamily(
  input: BlueprintInput,
  families: readonly QuestionFamily[],
  slotMarks: number,
  index: number,
  salt: string
): QuestionFamily {
  const ordered = rotate(families, rotation(input, families.length, salt));
  const sensible = ordered.filter((family) => {
    const definition = questionFamilyDefinition(family);
    return (
      slotMarks >= definition.minimumSensibleMarks &&
      slotMarks <= definition.maximumSensibleMarks
    );
  });
  return (sensible.length ? sensible : ordered)[index % (sensible.length || ordered.length)];
}

function buildSlotDrafts(
  input: BlueprintInput,
  groups: readonly ProfileGroup[],
  sectionMarks: readonly number[]
): SlotDraft[] {
  const drafts: SlotDraft[] = [];

  groups.forEach((group, sectionIndex) => {
    const marks = sectionMarks[sectionIndex];
    const preferredMarks =
      sum(
        group.families.map(
          (family) => questionFamilyDefinition(family).preferredMarks
        )
      ) / group.families.length;
    let slotCount = Math.max(1, Math.round(marks / preferredMarks));
    if (input.assessmentType.id === "quiz") slotCount = Math.min(slotCount, 6);
    if (input.educationLevel === "Lower Primary") {
      slotCount = Math.min(slotCount, 8);
    }
    slotCount = Math.min(slotCount, marks);
    const marksBySlot = allocateIntegerMarks(
      marks,
      Array.from({ length: slotCount }, () => 1)
    );

    marksBySlot.forEach((slotMarks, slotIndex) => {
      const family = selectFamily(
        input,
        group.families,
        slotMarks,
        slotIndex,
        `section-${sectionIndex}`
      );
      const familyDefinition = questionFamilyDefinition(family);
      const constraints = [
        "USE_SELECTED_CURRICULUM_ONLY",
        "DO_NOT_GENERATE_ANSWER_IN_SLOT",
        "TEACHER_REVIEW_REQUIRED",
      ];
      if (input.educationLevel === "Lower Primary") {
        constraints.push("LOWER_PRIMARY_AGE_APPROPRIATE");
      }
      if (input.component?.componentType === "PRACTICAL") {
        constraints.push(
          "NO_DANGEROUS_OR_UNSUPPORTED_PROCEDURE",
          "PRACTICAL_SAFETY_REVIEW_REQUIRED"
        );
      }
      if (input.component) constraints.push("KEEP_WITHIN_COMPONENT_PROFILE");

      drafts.push({
        id: `slot-${String(sectionIndex + 1).padStart(2, "0")}-${String(slotIndex + 1).padStart(2, "0")}`,
        sectionId: `section-${String(sectionIndex + 1).padStart(2, "0")}`,
        targetMarks: slotMarks,
        questionFamily: family,
        questionFamilyLabel: familyDefinition.label,
        estimatedMinutes: Math.max(
          1,
          Math.round(slotMarks * familyDefinition.estimatedMinutesPerMark)
        ),
        constraints,
        evidenceStatus: "APPLICATION_HEURISTIC",
      });
    });
  });

  return drafts;
}

function cognitiveTargets(
  input: BlueprintInput,
  drafts: readonly SlotDraft[]
): { targets: CognitiveTarget[]; demands: CognitiveDemand[] } {
  const percentages = COGNITIVE_PERCENTAGES[input.difficulty];
  const targetMarks = allocateIntegerMarks(
    input.totalMarks,
    COGNITIVE_ORDER.map((demand) => percentages[demand])
  );
  const plannedMarks = COGNITIVE_ORDER.map(() => 0);
  const demands: CognitiveDemand[] = [];

  for (const draft of drafts) {
    const ranked = COGNITIVE_ORDER.map((demand, index) => ({
      demand,
      index,
      remaining: targetMarks[index] - plannedMarks[index],
    })).sort((a, b) => b.remaining - a.remaining || a.index - b.index);
    const selected = ranked[0];
    demands.push(selected.demand);
    plannedMarks[selected.index] += draft.targetMarks;
  }

  return {
    targets: COGNITIVE_ORDER.map((demand, index) => ({
      demand,
      targetPercent: percentages[demand],
      targetMarks: targetMarks[index],
      plannedMarks: plannedMarks[index],
    })),
    demands,
  };
}

function assignCurriculum(
  input: BlueprintInput,
  drafts: readonly SlotDraft[],
  allocations: readonly TopicAllocation[]
): string[][] {
  const remaining = allocations.map((allocation) => allocation.targetMarks);
  const baseOrder = allocations.map((_, index) => index);
  const order = rotate(
    baseOrder,
    rotation(input, allocations.length, "curriculum")
  );

  return drafts.map((draft) => {
    const selectedIndex = [...order].sort(
      (a, b) => remaining[b] - remaining[a] || order.indexOf(a) - order.indexOf(b)
    )[0];
    remaining[selectedIndex] -= draft.targetMarks;
    return [allocations[selectedIndex].curriculumId];
  });
}

function aggregateQuestionTypes(
  slots: readonly QuestionSlot[]
): QuestionTypeTarget[] {
  const targets = new Map<QuestionFamily, QuestionTypeTarget>();
  for (const slot of slots) {
    const current = targets.get(slot.questionFamily) ?? {
      family: slot.questionFamily,
      label: slot.questionFamilyLabel,
      slotCount: 0,
      targetMarks: 0,
      evidenceStatus: "APPLICATION_HEURISTIC" as const,
    };
    current.slotCount += 1;
    current.targetMarks += slot.targetMarks;
    targets.set(slot.questionFamily, current);
  }
  return [...targets.values()];
}

function aggregateCognitive(slots: readonly QuestionSlot[]): CognitiveTarget[] {
  return COGNITIVE_ORDER.map((demand) => ({
    demand,
    targetPercent: 0,
    targetMarks: 0,
    plannedMarks: sum(
      slots
        .filter((slot) => slot.cognitiveDemand === demand)
        .map((slot) => slot.targetMarks)
    ),
  }));
}

function timeFitStatus(
  estimatedCompletionMinutes: number,
  selectedDurationMinutes: number
): TimeFitStatus {
  if (estimatedCompletionMinutes > selectedDurationMinutes * 1.15) {
    return "WARNING_TIME_PRESSURE";
  }
  if (estimatedCompletionMinutes < selectedDurationMinutes * 0.55) {
    return "WARNING_TOO_LIGHT";
  }
  return "OK";
}

function buildEvidence(
  input: BlueprintInput,
  grounding: ReturnType<typeof outcomeGrounding>
): BlueprintEvidence[] {
  const evidence: BlueprintEvidence[] = [
    {
      field: "curriculumScope",
      status: input.curriculum.every(
        (node) => node.verificationStatus === "verified_official"
      )
        ? "OFFICIAL_CONSTRAINT"
        : "SOURCE_REQUIRED",
      note:
        "Curriculum names and relationships retain their stored verification status; provisional records are not promoted.",
      sourceRef: null,
    },
    {
      field: "outcomeGrounding",
      status: grounding.evidenceStatus,
      note:
        grounding.evidenceStatus === "SOURCE_REQUIRED"
          ? "No missing learning outcomes or objectives were invented; planning uses the selected hierarchy only."
          : "Canonical curriculum records indicate outcome or objective grounding is available.",
      sourceRef: null,
    },
    {
      field: "marksSectionsSlotsDifficultyTiming",
      status: "APPLICATION_HEURISTIC",
      note:
        "Section design, integer mark distribution, question families, cognitive targets and time estimates are configurable application planning rules, not official KNEC specifications.",
      sourceRef: null,
    },
  ];

  if (input.component) {
    evidence.unshift({
      field: "componentIdentityAndDuration",
      status: "OFFICIAL_CONSTRAINT",
      note:
        "Component identity, code, type and duration reuse the project's verified canonical KNEC component rule.",
      sourceRef: input.component.source.reference,
    });
  }
  return evidence;
}

export function buildExamBlueprint(input: BlueprintInput): ExamBlueprint {
  const inputIssues = validateBlueprintInput(input);
  if (inputIssues.some((candidate) => candidate.severity === "ERROR")) {
    throw new BlueprintBuildError(inputIssues);
  }

  const curriculum = orderedCurriculum(input);
  const profile = resolveSubjectBlueprintProfile(input);
  const groups = activeGroups(input, profile.groups);
  const sectionMarks = allocateIntegerMarks(
    input.totalMarks,
    groups.map((group) => group.weight)
  );
  const allFamilies = [...new Set(groups.flatMap((group) => group.families))];
  const topicAllocations = buildTopicAllocations(
    input,
    curriculum,
    allFamilies
  );
  const slotDrafts = buildSlotDrafts(input, groups, sectionMarks);
  const cognition = cognitiveTargets(input, slotDrafts);
  const curriculumTargets = assignCurriculum(
    input,
    slotDrafts,
    topicAllocations
  );
  const questionSlots: QuestionSlot[] = slotDrafts.map((draft, index) => ({
    ...draft,
    cognitiveDemand: cognition.demands[index],
    curriculumTargetIds: curriculumTargets[index],
  }));

  for (const allocation of topicAllocations) {
    allocation.slotCount = questionSlots.filter((slot) =>
      slot.curriculumTargetIds.includes(allocation.curriculumId)
    ).length;
  }

  const sections: BlueprintSection[] = groups.map((group, index) => {
    const id = `section-${String(index + 1).padStart(2, "0")}`;
    const slots = questionSlots.filter((slot) => slot.sectionId === id);
    const sectionCognitive = aggregateCognitive(slots).map((target) => ({
      ...target,
      targetMarks: target.plannedMarks,
      targetPercent: Math.round((target.plannedMarks / sectionMarks[index]) * 100),
    }));
    const sectionPercentResidual =
      100 - sum(sectionCognitive.map((target) => target.targetPercent));
    if (sectionCognitive.length && sectionPercentResidual !== 0) {
      sectionCognitive[0].targetPercent += sectionPercentResidual;
    }

    return {
      id,
      label: group.label,
      purpose: group.purpose,
      targetMarks: sectionMarks[index],
      estimatedMinutes: sum(slots.map((slot) => slot.estimatedMinutes)),
      questionTypeTargets: aggregateQuestionTypes(slots),
      topicAllocationIds: [
        ...new Set(slots.flatMap((slot) => slot.curriculumTargetIds)),
      ],
      cognitiveTargets: sectionCognitive,
      slotIds: slots.map((slot) => slot.id),
      evidenceStatus: "APPLICATION_HEURISTIC",
    };
  });

  const estimatedCompletionMinutes = sum(
    questionSlots.map((slot) => slot.estimatedMinutes)
  );
  const fitStatus = timeFitStatus(
    estimatedCompletionMinutes,
    input.durationMinutes
  );
  const grounding = outcomeGrounding(input);
  const parentCount = new Set(curriculum.map((node) => node.parentId)).size;

  const blueprintWithoutValidation: BlueprintForValidation = {
    blueprintVersion: BLUEPRINT_VERSION,
    educationSystem: input.educationSystem,
    educationLevel: input.educationLevel,
    gradeId: input.gradeId,
    gradeName: input.gradeName,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    assessmentType: {
      id: input.assessmentType.id,
      label: input.assessmentType.label,
      evidenceStatus: "APPLICATION_HEURISTIC",
    },
    examStructure: {
      id: input.examStructure,
      structureOrigin: structureOrigin(input),
      evidenceStatus: "APPLICATION_HEURISTIC",
    },
    component: input.component
      ? {
          id: input.component.id,
          paperCode: input.component.paperCode,
          displayName: input.component.label,
          componentType: input.component.componentType,
          verifiedDurationMinutes: input.component.durationMinutes,
          verificationStatus: input.component.verificationStatus,
          sourceRef: input.component.source.reference,
          evidenceStatus: "OFFICIAL_CONSTRAINT",
        }
      : null,
    totalMarks: input.totalMarks,
    durationMinutes: input.durationMinutes,
    difficulty: input.difficulty,
    profileId: profile.id,
    curriculumScope: {
      selectedCount: curriculum.length,
      parentCount,
      outcomeGrounding: grounding.value,
      evidenceStatus: grounding.evidenceStatus,
      selectedCurriculumIds: curriculum.map((node) => node.curriculumId),
    },
    sections,
    topicAllocations,
    questionSlots,
    questionTypeTargets: aggregateQuestionTypes(questionSlots),
    difficultyProfile: {
      selectedDifficulty: input.difficulty,
      evidenceStatus: "APPLICATION_HEURISTIC",
    },
    cognitiveProfile: {
      targets: cognition.targets,
      evidenceStatus: "APPLICATION_HEURISTIC",
    },
    estimatedCompletionMinutes,
    timeFit: {
      status: fitStatus,
      selectedDurationMinutes: input.durationMinutes,
      estimatedCompletionMinutes,
      evidenceStatus: "APPLICATION_HEURISTIC",
    },
    evidence: buildEvidence(input, grounding),
    teacherReviewRequired: true,
    variationSeed: input.seed ?? null,
  };

  const validation = validateExamBlueprint(blueprintWithoutValidation, input);
  if (!validation.isValid) throw new BlueprintBuildError(validation.errors);
  return { ...blueprintWithoutValidation, validation };
}
