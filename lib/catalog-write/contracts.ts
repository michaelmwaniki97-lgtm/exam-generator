export interface CatalogWriteRepository {
  createSubject(name: string): Promise<void>;
  updateSubject(id: string, name: string): Promise<void>;
  deleteSubject(id: string): Promise<boolean>;
  createGrade(name: string, level: string): Promise<void>;
  updateGrade(id: string, name: string, level: string): Promise<void>;
  deleteGrade(id: string): Promise<boolean>;
}
