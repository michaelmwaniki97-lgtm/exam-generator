import type { StoredExamContent, StoredMarkingContent } from "../exam-editor/core.ts";

export type ExamRelationName = { name: string } | null;

export type RecentTeacherExam = {
  id: string;
  exam_type: string;
  status: string;
  created_at: string;
  subjects: ExamRelationName;
  grades: ExamRelationName;
};

export type TeacherExamListItem = RecentTeacherExam & {
  marks: number;
  duration: number;
  difficulty: string;
  term: string | null;
  year: number | null;
};

export type TeacherExamForEditing = {
  id: string;
  teacher_id: string;
  subject_id: string;
  grade_id: string;
  exam_type: string;
  difficulty: string;
  status: string;
  revision: number;
  content: StoredExamContent;
  marking_schemes: Array<{ content: StoredMarkingContent }>;
};

export type ExamDocumentAccessMetadata = {
  id: string;
  status: string;
  revision: number;
};

export type TeacherExamPaymentMetadata = {
  id: string;
  status: string;
};

export type AuthorizedExamDocumentRow = {
  id: string;
  exam_type: string;
  marks: number;
  duration: number;
  term: string | null;
  year: number | null;
  content: unknown;
  teachers: { school: string | null } | null;
  marking_schemes: Array<{ content: unknown }>;
};

export interface ExamReadRepository {
  listRecentTeacherExams(limit: number): Promise<RecentTeacherExam[]>;
  listTeacherExams(): Promise<TeacherExamListItem[]>;
  getTeacherExamForEditing(id: string): Promise<TeacherExamForEditing | null>;
  getTeacherExamPaymentMetadata(id: string): Promise<TeacherExamPaymentMetadata | null>;
}

export interface TrustedExamReadRepository {
  teacherOwnsExam(id: string, teacherId: string): Promise<boolean>;
}

export interface ExamDocumentReadRepository {
  getDocumentAccessMetadata(id: string): Promise<ExamDocumentAccessMetadata | null>;
  getAuthorizedExamDocument(id: string, includeMarking: boolean): Promise<AuthorizedExamDocumentRow | null>;
}
