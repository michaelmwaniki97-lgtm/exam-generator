import type { ExamBlueprint } from "../blueprint/types.ts";
import { readFile } from "node:fs/promises";
import { describeGroundingProvenanceViolations, describeViolations, generateMarkingContentWithCompletion, generateQuestionContentWithCompletion, type GeneratedExam, type TextbookGroundingContext } from "./generation-core.ts";
import { buildExamDocument, type ExamDocumentInput } from "../exam-document/model.ts";

const ids = Array.from({ length: 6 }, (_, index) => `slot-0${index + 1}`);
const marks = [5, 5, 5, 5, 5, 5];
export const offlineGrounding: TextbookGroundingContext = { textbookId: "grade-8-maths", chunks: [{ chunkId: "fractions-source", documentId: "grade-8-book", pageStart: 42, pageEnd: 42, text: "A fraction describes equal parts of a whole." }] };

export function offlineBlueprint(): ExamBlueprint {
  return {
    blueprintVersion: 1, totalMarks: 30, durationMinutes: 45,
    assessmentProfile: { generalInstructions: ["Answer all questions.", "Show your working where necessary."], ruleStatus: "SCHOOL_HEURISTIC", paper: { paperCode: null } },
    assessmentType: { id: "cat", label: "CAT" }, examStructure: { structureOrigin: "SCHOOL_ASSESSMENT" }, component: null,
    sections: [{ id: "section-01", label: "Mathematics", slotIds: ids, targetMarks: 30, markAuthority: "GENERATION_FLEXIBLE", instructions: [] }],
    topicAllocations: ids.map((_, index) => ({ curriculumId: `math-${index + 1}`, parentId: "math-strand", parentName: "Mathematics", displayName: `Grade 8 Mathematics Topic ${index + 1}` })),
    questionSlots: ids.map((id, index) => ({ id, sectionId: "section-01", targetMarks: marks[index], questionFamily: "structured_response", questionFamilyLabel: "Structured response", curriculumTargetIds: [`math-${index + 1}`], cognitiveDemand: "APPLICATION", constraints: ["KEEP_WITHIN_COMPONENT_PROFILE"], allowedStimulusTypes: index === 5 ? ["passage"] : [], allowedMarkingModels: ["point_based"] })),
  } as unknown as ExamBlueprint;
}

const visual = { kind: "graph" as const, required: true, altText: "A line graph of five exercise sessions.", graphType: "line" as const, xLabel: "Session", xUnit: "number", yLabel: "Score", yUnit: "marks", points: [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }, { x: 4, y: 8 }, { x: 5, y: 10 }] };

function rows() {
  return ids.map((slotId, index) => ({ slotId, topic: `Topic ${index + 1}`, options: [], text: index === 0 ? "Use the graph to state the score in session 4." : index === 5 ? "Read the supplied passage and write the fraction named in it." : `Calculate the value of ${index + 2} + ${index + 3}.`, visual: index === 0 ? visual : null, ...(index === 5 ? { stimuli: [{ type: "passage", id: "fraction-passage", title: "Fraction reminder", content: "One half is written as 1/2.", sourceType: "authorized_textbook", provenance: { textbookId: "grade-8-maths", documentId: "grade-8-book", chunkIds: ["fractions-source"] } }] } : {}) }));
}

export async function createOfflineProductionExam(replayInlineData = false): Promise<{ exam: GeneratedExam; blueprint: ExamBlueprint; documentInput: ExamDocumentInput }> {
  const blueprint = offlineBlueprint();
  const saved = replayInlineData ? JSON.parse(await readFile("lib/ai/fixtures/rejected-marking-inline-data.json", "utf8")) : undefined;
  const questionRows = rows();
  if (saved) {
    questionRows[2].text = saved.question.text;
    blueprint.questionSlots[2].targetMarks = 4;
    blueprint.questionSlots[2].allowedMarkingModels = ["numerical_method"];
    blueprint.questionSlots[3].targetMarks = 6;
  }
  let batch = 0;
  const sections = await generateQuestionContentWithCompletion({ blueprint, topics: [], subjectName: "Mathematics", gradeName: "Grade 8", level: "Junior School", examType: "CAT", difficulty: "medium", textbookContext: offlineGrounding }, async () => JSON.stringify({ questions: questionRows.slice(batch++ * 2, batch * 2) }));
  let entry = 0;
  const marking = await generateMarkingContentWithCompletion({ blueprint, questions: sections }, async () => {
    const index = entry++;
    if (saved && index === 2) return JSON.stringify(saved.marking);
    const answer = index === 0 ? "According to the graph, the score in session 4 is 8 marks." : index === 5 ? "According to the passage, one half is written as 1/2." : `The sum is ${(index + 2) + (index + 3)}.`;
    return JSON.stringify({ markingModel: "point_based", answer, marking_notes: "Award marks for the stated correct result.", allocations: [{ label: "States the correct result from the supplied information", marks: blueprint.questionSlots[index].targetMarks }] });
  });
  const exam: GeneratedExam = { instructions: "Answer all questions.\nShow your working where necessary.", sections, marking_scheme: marking };
  const structuralViolations = describeViolations(exam, blueprint).filter((problem) => {
    const advisoryMarkingProblem =
      /^marking entry /i.test(problem) &&
      /generic marking notes|generic allocation|placeholder|merely restates|resource that is not validly attached|gives no worked numerical result/i.test(problem);

    return !advisoryMarkingProblem && !/too broad/i.test(problem);
  });

  const violations = [
    ...structuralViolations,
    ...describeGroundingProvenanceViolations(exam, offlineGrounding),
  ];
  if (violations.length) throw new Error(`Offline production fixture validation failed: ${violations.join("; ")}`);
  const documentInput: ExamDocumentInput = { id: "11111111-1111-4111-8111-111111111111", examType: "CAT", marks: 30, duration: 45, term: "Term 1", year: 2026, school: "Offline Test School", content: { instructions: exam.instructions, sections: exam.sections, meta: { subjectName: "Mathematics", gradeName: "Grade 8", level: "Junior School", blueprint } }, markingContent: { entries: exam.marking_scheme } };
  return { exam, blueprint, documentInput };
}

export function offlineStudentDocument() { return createOfflineProductionExam().then(({ documentInput }) => buildExamDocument(documentInput, "student")); }
export function offlineMarkingDocument() { return createOfflineProductionExam().then(({ documentInput }) => buildExamDocument(documentInput, "marking")); }

