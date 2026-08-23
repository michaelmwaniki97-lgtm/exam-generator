import type {
  CurriculumVerificationStatus,
} from "@/lib/curriculum/exam-selection";
import type {
  EducationSystem,
  ExamStructure,
  OfficialComponent,
  SchoolAssessmentType,
} from "@/lib/assessment/rules";
import type { AssessmentProfile } from "@/lib/assessment/profiles";
import type { SupportedStimulusType } from "@/lib/assessment/rich-content";
import type { MarkingModel } from "@/lib/assessment/marking-models";

export const BLUEPRINT_VERSION = 1 as const;

export type EvidenceStatus =
  | "OFFICIAL_CONSTRAINT"
  | "APPLICATION_HEURISTIC"
  | "SOURCE_REQUIRED";

export type CognitiveDemand =
  | "FOUNDATIONAL"
  | "APPLICATION"
  | "REASONING";

export type TimeFitStatus =
  | "OK"
  | "WARNING_TIME_PRESSURE"
  | "WARNING_TOO_LIGHT";

export type QuestionFamily =
  | "objective"
  | "very_short_response"
  | "short_response"
  | "structured_response"
  | "short_computation"
  | "structured_calculation"
  | "multi_step_problem_solving"
  | "application_context_problem"
  | "mathematical_reasoning"
  | "explanation"
  | "scientific_calculation"
  | "data_graph_interpretation"
  | "scientific_application"
  | "recall_knowledge"
  | "structured_explanation"
  | "interpretation_application"
  | "extended_response"
  | "functional_communication"
  | "comprehension"
  | "literary_appreciation"
  | "grammar_language_use"
  | "creative_composition"
  | "set_text_response"
  | "insha"
  | "lugha"
  | "fasihi"
  | "practical_observation"
  | "practical_measurement"
  | "practical_recording"
  | "practical_data_handling"
  | "practical_calculation"
  | "practical_interpretation"
  | "practical_conclusion"
  | "rich_application_task";

export type StructureOrigin =
  | "STANDARD_SCHOOL"
  | "KJSEA_STYLE_PRACTICE"
  | "KCSE_STYLE_SCHOOL"
  | "KCSE_STYLE_MOCK"
  | "KCSE_STYLE_PRACTICE";

export type OutcomeGrounding =
  | "LEARNING_OUTCOMES_AVAILABLE"
  | "TOPIC_OBJECTIVES_AVAILABLE"
  | "STRAND_SUB_STRAND_ONLY"
  | "TOPIC_SUB_TOPIC_ONLY";

export type BlueprintCurriculumNode = {
  curriculumId: string;
  parentId: string;
  parentName: string;
  name: string;
  parentSortOrder: number;
  sortOrder: number;
  gradeId: string;
  subjectId: string;
  isActive: boolean;
  verificationStatus: CurriculumVerificationStatus;
  sourceRef: string | null;
  outcomesAvailable: boolean;
};

export type BlueprintInput = {
  educationSystem: EducationSystem;
  educationLevel: string;
  gradeId: string;
  gradeName: string;
  subjectId: string;
  subjectName: string;
  assessmentType: Pick<SchoolAssessmentType, "id" | "label">;
  examStructure: ExamStructure;
  allowedExamStructures: readonly ExamStructure[];
  component: OfficialComponent | null;
  allowedComponentIds: readonly string[];
  assessmentProfile: AssessmentProfile;
  totalMarks: number;
  durationMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  curriculum: readonly BlueprintCurriculumNode[];
  seed?: string;
};

export type BlueprintEvidence = {
  field: string;
  status: EvidenceStatus;
  note: string;
  sourceRef: string | null;
};

export type QuestionTypeTarget = {
  family: QuestionFamily;
  label: string;
  slotCount: number;
  targetMarks: number;
  evidenceStatus: "APPLICATION_HEURISTIC" | "OFFICIAL_CONSTRAINT";
};

export type CognitiveTarget = {
  demand: CognitiveDemand;
  targetPercent: number;
  targetMarks: number;
  plannedMarks: number;
};

export type TopicAllocation = {
  curriculumId: string;
  parentId: string;
  parentName: string;
  displayName: string;
  targetMarks: number;
  slotCount: number;
  allowedQuestionTypes: QuestionFamily[];
  verificationStatus: CurriculumVerificationStatus;
  evidenceStatus: EvidenceStatus;
  sourceRef: string | null;
};

export type QuestionSlot = {
  id: string;
  sectionId: string;
  targetMarks: number;
  questionFamily: QuestionFamily;
  questionFamilyLabel: string;
  curriculumTargetIds: string[];
  cognitiveDemand: CognitiveDemand;
  estimatedMinutes: number;
  constraints: string[];
  allowedStimulusTypes: SupportedStimulusType[];
  allowedMarkingModels: MarkingModel[];
  evidenceStatus: "APPLICATION_HEURISTIC";
};

export type BlueprintSection = {
  id: string;
  label: string;
  purpose: string;
  instructions: string[];
  targetMarks: number;
  markAuthority: "OFFICIAL_EXACT" | "GENERATION_FLEXIBLE";
  estimatedMinutes: number;
  questionTypeTargets: QuestionTypeTarget[];
  topicAllocationIds: string[];
  cognitiveTargets: CognitiveTarget[];
  slotIds: string[];
  evidenceStatus: "APPLICATION_HEURISTIC" | "OFFICIAL_CONSTRAINT";
};

export type BlueprintValidationIssue = {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
  evidenceStatus: EvidenceStatus;
};

export type BlueprintValidation = {
  isValid: boolean;
  errors: BlueprintValidationIssue[];
  warnings: BlueprintValidationIssue[];
  reconciliation: {
    requestedMarks: number;
    sectionMarks: number;
    slotMarks: number;
    topicAllocationMarks: number;
    difficultyPercent: number;
  };
  timeFitStatus: TimeFitStatus;
};

export type ExamBlueprint = {
  blueprintVersion: typeof BLUEPRINT_VERSION;
  educationSystem: EducationSystem;
  educationLevel: string;
  gradeId: string;
  gradeName: string;
  subjectId: string;
  subjectName: string;
  assessmentType: {
    id: SchoolAssessmentType["id"];
    label: string;
    evidenceStatus: "APPLICATION_HEURISTIC";
  };
  examStructure: {
    id: ExamStructure;
    structureOrigin: StructureOrigin;
    evidenceStatus: "APPLICATION_HEURISTIC";
  };
  component: {
    id: string;
    paperCode: string;
    displayName: string;
    componentType: "WRITTEN" | "PRACTICAL";
    verifiedDurationMinutes: number;
    verificationStatus: OfficialComponent["verificationStatus"];
    sourceRef: string;
    evidenceStatus: "OFFICIAL_CONSTRAINT";
  } | null;
  totalMarks: number;
  durationMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  profileId: string;
  assessmentProfile: AssessmentProfile;
  curriculumScope: {
    selectedCount: number;
    parentCount: number;
    outcomeGrounding: OutcomeGrounding;
    evidenceStatus: EvidenceStatus;
    selectedCurriculumIds: string[];
  };
  sections: BlueprintSection[];
  topicAllocations: TopicAllocation[];
  questionSlots: QuestionSlot[];
  questionTypeTargets: QuestionTypeTarget[];
  difficultyProfile: {
    selectedDifficulty: "easy" | "medium" | "hard";
    evidenceStatus: "APPLICATION_HEURISTIC";
  };
  cognitiveProfile: {
    targets: CognitiveTarget[];
    evidenceStatus: "APPLICATION_HEURISTIC";
  };
  estimatedCompletionMinutes: number;
  timeFit: {
    status: TimeFitStatus;
    selectedDurationMinutes: number;
    estimatedCompletionMinutes: number;
    evidenceStatus: "APPLICATION_HEURISTIC";
  };
  validation: BlueprintValidation;
  evidence: BlueprintEvidence[];
  teacherReviewRequired: true;
  variationSeed: string | null;
};

export type BlueprintForValidation = Omit<ExamBlueprint, "validation">;
