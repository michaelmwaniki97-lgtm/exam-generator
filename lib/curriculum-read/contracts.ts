import type { CurriculumVerificationStatus } from "../curriculum/exam-selection.ts";

export type CurriculumNameRow = { id: string; name: string };
export type OutcomeNameRow = { id: string; description: string };
export type ParentRow = { id: string; parent_id: string };

export type WizardSubjectContext = {
  grade_id: string;
  subject_id: string;
  is_active: boolean;
  verification_status: CurriculumVerificationStatus;
  subject: { id: string; name: string } | null;
};

export type WizardSubStrand = CurriculumNameRow & {
  sort_order: number;
  source_code: string | null;
  source_ref: string | null;
  verification_status: CurriculumVerificationStatus;
};

export type WizardStrand = CurriculumNameRow & {
  sort_order: number;
  source_code: string | null;
  source_ref: string | null;
  verification_status: CurriculumVerificationStatus;
  is_active: boolean;
  sub_strands: WizardSubStrand[];
};

export type SelectionOutcome = { description: string; sort_order: number };
export type SelectionObjective = { description: string; sort_order: number };
export type SelectionTopic = CurriculumNameRow & {
  sort_order: number;
  source_ref: string | null;
  verification_status: CurriculumVerificationStatus;
  strands: (CurriculumNameRow & {
    sort_order: number;
    subject_id: string;
    grade_id: string;
    is_active: boolean;
    source_ref: string | null;
    verification_status: CurriculumVerificationStatus;
    strand_objectives: SelectionObjective[];
  }) | null;
  learning_outcomes: SelectionOutcome[];
};

export type AdminOutcome = OutcomeNameRow & {
  sort_order: number;
  verification_status: CurriculumVerificationStatus;
};
export type AdminSubStrand = CurriculumNameRow & {
  sort_order: number;
  source_code: string | null;
  verification_status: CurriculumVerificationStatus;
  learning_outcomes: AdminOutcome[];
};
export type AdminObjective = OutcomeNameRow & {
  label: string | null;
  sort_order: number;
  verification_status: CurriculumVerificationStatus;
};
export type AdminStrand = CurriculumNameRow & {
  sort_order: number;
  source_code: string | null;
  verification_status: CurriculumVerificationStatus;
  outcome_status: "unverified" | "sourced" | "source_required";
  strand_objectives: AdminObjective[];
  sub_strands: AdminSubStrand[];
};

export interface CurriculumReadRepository {
  listActiveGradeIds(): Promise<string[]>;
  listSubjectContextsForGrade(gradeId: string): Promise<WizardSubjectContext[]>;
  listActiveHierarchy(gradeId: string, subjectId: string): Promise<WizardStrand[]>;
  getSelectionTopics(ids: readonly string[]): Promise<SelectionTopic[]>;
  listAdminHierarchy(gradeId: string, subjectId: string): Promise<AdminStrand[]>;
  countStrandsBySubject(subjectId: string): Promise<number>;
  countStrandsByGrade(gradeId: string): Promise<number>;
  listStrandNames(gradeId: string, subjectId: string): Promise<CurriculumNameRow[]>;
  getStrandParent(id: string): Promise<{ id: string; grade_id: string; subject_id: string } | null>;
  countSubStrands(strandId: string): Promise<number>;
  listSubStrandNames(strandId: string): Promise<CurriculumNameRow[]>;
  getSubStrandParent(id: string): Promise<ParentRow | null>;
  countLearningOutcomes(subStrandId: string): Promise<number>;
  listLearningOutcomeDescriptions(subStrandId: string): Promise<OutcomeNameRow[]>;
  getLearningOutcomeParent(id: string): Promise<ParentRow | null>;
}
