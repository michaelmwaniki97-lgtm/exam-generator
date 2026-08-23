import type { EducationSystem, ExamStructure, OfficialComponent, SchoolAssessmentTypeId } from "./rules.ts";
import type { QuestionFamily } from "../blueprint/types.ts";

export type AssessmentRuleStatus = "OFFICIAL_VERIFIED" | "SCHOOL_HEURISTIC" | "UNKNOWN";
export type MarkingModelHint = "point_based" | "numerical_method" | "essay_rubric" | "composition_rubric" | "practical_rubric" | "performance_rubric" | "mixed";
export type StimulusCapability = "none" | "passage" | "table" | "dataset" | "diagram" | "graph" | "map" | "extract";

export type AssessmentProfileSection = {
  id: string;
  title: string;
  marks: number | null;
  questionCount: { exact?: number; min?: number; max?: number } | null;
  allowedQuestionFamilies: readonly QuestionFamily[];
  fixedFamilyCounts?: Partial<Record<QuestionFamily, number>>;
  compulsory: boolean | null;
  instructions: readonly string[];
  order: number;
};

export type AssessmentProfile = {
  profileId: string;
  curriculumSystem: EducationSystem;
  level: string;
  subject: string;
  assessmentType: SchoolAssessmentTypeId;
  componentId: string | null;
  ruleStatus: AssessmentRuleStatus;
  authority: {
    authorityName: string;
    sourceTitle: string;
    sourceDate: string | null;
    sourceUrl: string | null;
    reference: string | null;
    verificationNotes: string;
  };
  paper: {
    paperCode: string | null;
    paperName: string;
    totalMarks: number | null;
    durationMinutes: number | null;
    paperCount: number | null;
  };
  sections: readonly AssessmentProfileSection[];
  generalInstructions: readonly string[];
  markingModelHint: MarkingModelHint;
  stimulusCapabilities: readonly StimulusCapability[];
  coveragePolicy: "VERY_NARROW" | "NARROW_SELECTED" | "TAUGHT_TO_DATE" | "BROAD_SELECTED" | "TEACHER_CONFIGURED" | "OFFICIAL_COMPONENT";
};

export type AssessmentProfileInput = {
  educationSystem: EducationSystem;
  level: string;
  gradeName: string;
  subjectName: string;
  assessmentType: SchoolAssessmentTypeId;
  examStructure: ExamStructure;
  component: OfficialComponent | null;
  requestedMarks: number;
  requestedDurationMinutes: number;
};

const KJSEA_SOURCE = {
  authorityName: "Kenya National Examinations Council",
  sourceTitle: "KJSEA Regulations",
  sourceDate: "2026-02",
  sourceUrl: "https://www.knec.ac.ke/wp-content/uploads/2026/02/KJSEA-REGULATIONS.pdf",
  reference: "KJSEA subject and paper format schedules",
  verificationNotes: "Current official KNEC regulations verified for paper identity, marks, duration and stated section allocations.",
} as const;

const section = (id: string, title: string, marks: number | null, families: readonly QuestionFamily[], order: number, options: Partial<AssessmentProfileSection> = {}): AssessmentProfileSection => ({
  id, title, marks, questionCount: null, allowedQuestionFamilies: families, compulsory: true,
  instructions: ["Answer all questions in this section."], order, ...options,
});

type NationalDefinition = Omit<AssessmentProfile, "assessmentType" | "componentId" | "curriculumSystem" | "level" | "authority" | "ruleStatus" | "coveragePolicy">;

const KJSEA: Readonly<Record<string, NationalDefinition>> = {
  "901/1": { profileId: "kjsea-901-1", subject: "English", paper: { paperCode: "901/1", paperName: "English Paper 1", totalMarks: 50, durationMinutes: 100, paperCount: 2 }, sections: [
    section("listening-speaking", "Listening and Speaking", 5, ["functional_communication"], 1),
    section("cloze", "Cloze Test", 10, ["grammar_language_use"], 2),
    section("reading", "Reading Comprehension", 20, ["comprehension"], 3, { questionCount: { exact: 4 }, fixedFamilyCounts: { comprehension: 4 } }),
    section("grammar", "Grammar", 15, ["grammar_language_use"], 4),
  ], generalInstructions: ["Answer all questions in the spaces provided.", "Observe the marks shown for each question."], markingModelHint: "mixed", stimulusCapabilities: ["passage", "extract"] },
  "901/2": { profileId: "kjsea-901-2", subject: "English", paper: { paperCode: "901/2", paperName: "English Paper 2", totalMarks: 50, durationMinutes: 105, paperCount: 2 }, sections: [
    section("composition", "Composition", 15, ["creative_composition"], 1, { questionCount: { exact: 1 }, fixedFamilyCounts: { creative_composition: 1 } }),
    section("oral-literature", "Oral Literature", 10, ["literary_appreciation"], 2), section("novella-short-story", "Novella / Short Story", 10, ["literary_appreciation"], 3),
    section("play", "Play", 10, ["literary_appreciation"], 4), section("poetry", "Poetry", 5, ["literary_appreciation"], 5),
  ], generalInstructions: ["Answer all questions.", "Observe the marks shown for each question."], markingModelHint: "mixed", stimulusCapabilities: ["passage", "extract"] },
  "902/1": { profileId: "kjsea-902-1", subject: "Kiswahili", paper: { paperCode: "902/1", paperName: "Kiswahili Karatasi ya 1", totalMarks: 50, durationMinutes: 100, paperCount: 2 }, sections: [
    section("ufahamu", "Ufahamu", 20, ["comprehension"], 1), section("kusikiliza-kuzungumza", "Kusikiliza na Kuzungumza", 5, ["functional_communication"], 2), section("sarufi", "Sarufi", 25, ["lugha"], 3),
  ], generalInstructions: ["Jibu maswali yote.", "Zingatia alama zilizoonyeshwa."], markingModelHint: "mixed", stimulusCapabilities: ["passage", "extract"] },
  "902/2": { profileId: "kjsea-902-2", subject: "Kiswahili", paper: { paperCode: "902/2", paperName: "Kiswahili Karatasi ya 2", totalMarks: 50, durationMinutes: 105, paperCount: 2 }, sections: [
    section("insha", "Insha", 15, ["insha"], 1, { questionCount: { exact: 1 }, fixedFamilyCounts: { insha: 1 } }), section("fasihi-simulizi", "Fasihi Simulizi", 10, ["fasihi"], 2),
    section("novela", "Novela", 10, ["fasihi"], 3), section("tamthilia", "Tamthilia", 10, ["fasihi"], 4), section("ushairi", "Ushairi", 5, ["fasihi"], 5),
  ], generalInstructions: ["Jibu maswali yote.", "Zingatia alama zilizoonyeshwa."], markingModelHint: "mixed", stimulusCapabilities: ["passage", "extract"] },
  "903": { profileId: "kjsea-903", subject: "Mathematics", paper: { paperCode: "903", paperName: "Mathematics", totalMarks: 100, durationMinutes: 120, paperCount: 1 }, sections: [
    section("section-a", "Section A", 20, ["objective"], 1, { questionCount: { exact: 20 }, fixedFamilyCounts: { objective: 20 }, instructions: ["Answer all 20 multiple-choice questions."] }),
    section("section-b", "Section B", 80, ["structured_calculation", "multi_step_problem_solving", "application_context_problem", "mathematical_reasoning"], 2),
  ], generalInstructions: ["Answer all questions.", "For Section A, select one answer for each item.", "Show necessary working for structured questions."], markingModelHint: "numerical_method", stimulusCapabilities: ["table", "dataset", "diagram", "graph"] },
  "905/1": { profileId: "kjsea-905-1", subject: "Integrated Science", paper: { paperCode: "905/1", paperName: "Integrated Science Paper 1", totalMarks: 70, durationMinutes: 100, paperCount: 2 }, sections: [
    section("section-a", "Section A", 30, ["objective"], 1, { questionCount: { exact: 30 }, fixedFamilyCounts: { objective: 30 }, instructions: ["Answer all 30 multiple-choice questions."] }),
    section("section-b", "Section B", 40, ["structured_response", "explanation", "scientific_calculation", "scientific_application"], 2),
  ], generalInstructions: ["Answer all questions.", "For Section A, select one answer for each item."], markingModelHint: "mixed", stimulusCapabilities: ["table", "dataset", "diagram", "graph"] },
  "905/2": { profileId: "kjsea-905-2", subject: "Integrated Science", paper: { paperCode: "905/2", paperName: "Integrated Science Paper 2 — Written Practical Skills", totalMarks: 30, durationMinutes: 60, paperCount: 2 }, sections: [
    section("chemistry", "Chemistry Practical Skills", null, ["practical_observation", "practical_data_handling", "practical_interpretation"], 1, { questionCount: { exact: 1 } }),
    section("biology", "Biology Practical Skills", null, ["practical_observation", "practical_data_handling", "practical_interpretation"], 2, { questionCount: { exact: 1 } }),
    section("physics", "Physics Practical Skills", null, ["practical_measurement", "practical_calculation", "practical_interpretation"], 3, { questionCount: { exact: 1 } }),
  ], generalInstructions: ["Answer all three written practical-skills questions.", "Record observations, working and conclusions where required."], markingModelHint: "practical_rubric", stimulusCapabilities: ["table", "dataset", "diagram", "graph"] },
  "907": { profileId: "kjsea-907", subject: "Social Studies", paper: { paperCode: "907", paperName: "Social Studies", totalMarks: 100, durationMinutes: 90, paperCount: 1 }, sections: [section("section-a", "Section A", 20, ["objective"], 1, { questionCount: { exact: 20 }, fixedFamilyCounts: { objective: 20 } }), section("section-b", "Section B", 80, ["structured_response", "interpretation_application", "extended_response"], 2)], generalInstructions: ["Answer all questions.", "For Section A, select one answer for each item."], markingModelHint: "point_based", stimulusCapabilities: ["passage", "table", "map", "extract"] },
  "908": { profileId: "kjsea-908", subject: "Christian Religious Education", paper: { paperCode: "908", paperName: "Christian Religious Education", totalMarks: 100, durationMinutes: 90, paperCount: 1 }, sections: [section("section-a", "Section A", 20, ["objective"], 1, { questionCount: { exact: 20 }, fixedFamilyCounts: { objective: 20 } }), section("section-b", "Section B", 80, ["structured_explanation", "interpretation_application", "extended_response"], 2)], generalInstructions: ["Answer all questions.", "For Section A, select one answer for each item."], markingModelHint: "point_based", stimulusCapabilities: ["passage", "extract"] },
};

const COVERAGE: Record<SchoolAssessmentTypeId, AssessmentProfile["coveragePolicy"]> = { quiz: "VERY_NARROW", cat: "NARROW_SELECTED", midterm: "TAUGHT_TO_DATE", end_term: "BROAD_SELECTED", revision_test: "BROAD_SELECTED", diagnostic_assessment: "NARROW_SELECTED", assignment: "TEACHER_CONFIGURED", kjsea_practice: "OFFICIAL_COMPONENT", mock: "TEACHER_CONFIGURED", custom: "TEACHER_CONFIGURED" };

export function resolveAssessmentProfile(input: AssessmentProfileInput): AssessmentProfile {
  if (input.examStructure === "kjsea_style" && input.assessmentType !== "kjsea_practice") {
    throw new Error("KJSEA-style profiles require the canonical KJSEA Practice assessment mode.");
  }
  if (input.examStructure === "kjsea_style" && input.component) {
    const definition = KJSEA[input.component.paperCode];
    if (!definition || input.gradeName !== "Grade 9" || definition.subject !== input.subjectName) throw new Error("No verified KJSEA profile matches the canonical selection.");
    return { ...definition, curriculumSystem: "CBC", level: input.level, assessmentType: input.assessmentType, componentId: input.component.id, ruleStatus: "OFFICIAL_VERIFIED", authority: KJSEA_SOURCE, coveragePolicy: "OFFICIAL_COMPONENT" };
  }
  if (input.examStructure === "kcse_style" && input.component) {
    return { profileId: `kcse-${input.component.paperCode}`, curriculumSystem: input.educationSystem, level: input.level, subject: input.subjectName, assessmentType: input.assessmentType, componentId: input.component.id, ruleStatus: "UNKNOWN", authority: { authorityName: input.component.source.issuer, sourceTitle: input.component.source.title, sourceDate: input.component.source.publishedOn, sourceUrl: null, reference: input.component.source.reference, verificationNotes: "Component identity and duration are verified; exact marks, sections and question counts remain unknown and use school-derived blueprint rules." }, paper: { paperCode: input.component.paperCode, paperName: input.component.label, totalMarks: null, durationMinutes: input.component.durationMinutes, paperCount: null }, sections: [], generalInstructions: ["Answer questions according to the school-generated paper instructions.", "Observe the marks shown."], markingModelHint: input.component.componentType === "PRACTICAL" ? "practical_rubric" : "mixed", stimulusCapabilities: ["passage", "table", "dataset", "diagram", "graph", "map", "extract"], coveragePolicy: "OFFICIAL_COMPONENT" };
  }
  return { profileId: `school-${input.assessmentType}-${input.subjectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, curriculumSystem: input.educationSystem, level: input.level, subject: input.subjectName, assessmentType: input.assessmentType, componentId: null, ruleStatus: "SCHOOL_HEURISTIC", authority: { authorityName: "School / teacher", sourceTitle: "Application school-assessment policy", sourceDate: null, sourceUrl: null, reference: null, verificationNotes: "Teacher-selected marks, duration and curriculum; no national-paper claim." }, paper: { paperCode: null, paperName: "School assessment", totalMarks: input.requestedMarks, durationMinutes: input.requestedDurationMinutes, paperCount: null }, sections: [], generalInstructions: ["Answer all questions unless a section states otherwise.", "Observe the marks shown for each question."], markingModelHint: "mixed", stimulusCapabilities: ["passage", "table", "dataset", "diagram", "graph", "map", "extract"], coveragePolicy: COVERAGE[input.assessmentType] };
}

export function officialKjseaProfileCodes(): readonly string[] { return Object.keys(KJSEA); }
