export type AdminDependencies = {
  curriculum: number;
  textbooks: number;
  exams: number;
};

export type AdminTextbookMetadata = {
  id: string;
  name: string;
  publisher: string | null;
  subject: { name: string } | null;
  grade: { name: string } | null;
};

export interface AdminReportingRepository {
  countDashboardExams(): Promise<number>;
  getSubjectDependencies(subjectId: string): Promise<AdminDependencies>;
  getGradeDependencies(gradeId: string): Promise<AdminDependencies>;
  countExamsReferencingSubStrand(subStrandId: string): Promise<number>;
  listTextbookMetadata(): Promise<AdminTextbookMetadata[]>;
}
