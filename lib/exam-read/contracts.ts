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

export interface ExamReadRepository {
  listRecentTeacherExams(limit: number): Promise<RecentTeacherExam[]>;
  listTeacherExams(): Promise<TeacherExamListItem[]>;
  getTeacherExamForEditing(id: string): Promise<TeacherExamForEditing | null>;
}
