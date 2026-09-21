import type {
  EducationSystem,
  ExamStructure,
  SchoolAssessmentTypeId,
} from "@/lib/assessment/rules";
import type {
  CurriculumVerificationStatus,
  ExamStrand,
  ExamSubStrand,
  SubjectAvailability,
} from "@/lib/curriculum/exam-selection";

export type Grade = { id: string; name: string; level: string; sort_order: number };
export type Subject = SubjectAvailability;
export type Textbook = { id: string; name: string; publisher: string | null };
export type { CurriculumVerificationStatus };
export type SubStrand = ExamSubStrand;
export type Strand = ExamStrand;

export type Difficulty = "easy" | "medium" | "hard";
export type Term = "Term 1" | "Term 2" | "Term 3";

export type WizardData = {
  educationSystem: EducationSystem | "";
  level: string;
  gradeId: string;
  gradeName: string;
  term: Term | "";
  year: number | null;
  subjectId: string;
  subjectName: string;
  textbookId: string;
  textbookName: string;
  topicIds: string[];
  examType: SchoolAssessmentTypeId | "";
  examStructure: ExamStructure;
  componentId: string;
  marks: number | null;
  duration: number | null;
  difficulty: Difficulty | "";
};

export const EMPTY_WIZARD_DATA: WizardData = {
  educationSystem: "",
  level: "",
  gradeId: "",
  gradeName: "",
  term: "",
  year: new Date().getFullYear(),
  subjectId: "",
  subjectName: "",
  textbookId: "",
  textbookName: "",
  topicIds: [],
  examType: "",
  examStructure: "standard",
  componentId: "",
  marks: null,
  duration: null,
  difficulty: "",
};

export const STEP_LABELS = [
  "Class Details",
  "Subject",
  "Curriculum",
  "Assessment",
  "Settings",
  "Review",
];
