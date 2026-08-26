export type GradeRow = { id: string; name: string; level: string };
export type WizardGradeRow = GradeRow & { sort_order: number };
export type CatalogOptionRow = { id: string; name: string };

export interface CatalogRepository {
  listWizardGrades(): Promise<WizardGradeRow[]>;
  listGradesByCreation(): Promise<GradeRow[]>;
  listGradeOptionsByName(): Promise<CatalogOptionRow[]>;
  listGradeNames(): Promise<CatalogOptionRow[]>;
  getGradeById(id: string): Promise<GradeRow | null>;
  gradeExists(id: string): Promise<boolean>;
  listSubjectsByName(): Promise<CatalogOptionRow[]>;
  listSubjectNames(): Promise<CatalogOptionRow[]>;
  getSubjectById(id: string): Promise<CatalogOptionRow | null>;
  subjectExists(id: string): Promise<boolean>;
  countSubjects(): Promise<number>;
}
