export interface CurriculumWriteRepository {
  createStrand(gradeId: string, subjectId: string, name: string): Promise<void>;
  updateStrand(id: string, name: string): Promise<void>;
  deleteStrand(id: string): Promise<boolean>;
  createSubStrand(strandId: string, name: string): Promise<void>;
  updateSubStrand(id: string, name: string): Promise<void>;
  deleteSubStrand(id: string): Promise<boolean>;
  createLearningOutcome(subStrandId: string, description: string): Promise<void>;
  updateLearningOutcome(id: string, description: string): Promise<void>;
  deleteLearningOutcome(id: string): Promise<boolean>;
}
