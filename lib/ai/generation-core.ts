import type { ExamBlueprint, QuestionFamily } from "../blueprint/types.ts";
import { describeSemanticViolations } from "./semantic-quality.ts";

export type AiQuestionType = "objective" | "short_answer" | "structured" | "calculation" | "problem_solving" | "extended_response" | "language_task" | "comprehension" | "literary_response" | "practical_task";
export const QUESTION_FAMILY_TO_AI_TYPE: Readonly<Record<QuestionFamily, AiQuestionType>> = {
  objective: "objective", very_short_response: "short_answer", short_response: "short_answer", structured_response: "structured",
  short_computation: "calculation", structured_calculation: "calculation", multi_step_problem_solving: "problem_solving",
  application_context_problem: "problem_solving", mathematical_reasoning: "problem_solving", explanation: "structured",
  scientific_calculation: "calculation", data_graph_interpretation: "structured", scientific_application: "problem_solving",
  recall_knowledge: "short_answer", structured_explanation: "structured", interpretation_application: "problem_solving",
  extended_response: "extended_response", functional_communication: "language_task", comprehension: "comprehension",
  literary_appreciation: "literary_response", grammar_language_use: "language_task", creative_composition: "extended_response",
  set_text_response: "literary_response", insha: "extended_response", lugha: "language_task", fasihi: "literary_response",
  practical_observation: "practical_task", practical_measurement: "practical_task", practical_recording: "practical_task",
  practical_data_handling: "practical_task", practical_calculation: "practical_task", practical_interpretation: "practical_task",
  practical_conclusion: "practical_task", rich_application_task: "problem_solving",
};
type Demand = "FOUNDATIONAL" | "APPLICATION" | "REASONING";
export type GenerationBlueprintSlot = {
  slotId: string; number: number; sectionId: string; sectionTitle: string; marks: number;
  curriculumTargets: { curriculumId: string; parentId: string; parentName: string; displayName: string }[];
  questionFamily: QuestionFamily; questionFamilyLabel: string; allowedType: AiQuestionType; cognitiveDemand: Demand; constraints: string[];
};
export type GenerationBlueprint = {
  version: number; totalMarks: number; durationMinutes: number;
  component: null | { id: string; paperCode: string; displayName: string; componentType: "WRITTEN" | "PRACTICAL" };
  slots: GenerationBlueprintSlot[];
};
export type ExamQuestion = {
  slotId: string; number: number; sectionId: string; curriculumIds: string[]; topic: string; text: string; marks: number;
  questionFamily: QuestionFamily; type: AiQuestionType; cognitiveDemand: Demand; constraintAcknowledgements: string[]; options?: string[];
};
export type ExamSection = { id?: string; title: string; questions: ExamQuestion[] };
export type MarkAllocation = { label: string; marks: number };
export type MarkingSchemeEntry = { slotId?: string; number: number; answer: string; marking_notes: string; marks?: number; allocations?: MarkAllocation[] };
export type GeneratedExam = { instructions: string; sections: ExamSection[]; marking_scheme: MarkingSchemeEntry[] };
export type TopicInput = { strandName: string; subStrandName: string; outcomes: string[]; outcomeScope: "sub_strand" | "strand" };
export type GenerateExamCoreParams = {
  subjectName: string; gradeName: string; level: string; examType: string; difficulty: "easy" | "medium" | "hard";
  marks: number; duration: number; topics: TopicInput[]; textbookName?: string; blueprint: ExamBlueprint;
};

export function projectBlueprint(blueprint: ExamBlueprint): GenerationBlueprint {
  const sections = new Map(blueprint.sections.map((section) => [section.id, section]));
  const topics = new Map(blueprint.topicAllocations.map((topic) => [topic.curriculumId, topic]));
  return {
    version: blueprint.blueprintVersion, totalMarks: blueprint.totalMarks, durationMinutes: blueprint.durationMinutes,
    component: blueprint.component && { id: blueprint.component.id, paperCode: blueprint.component.paperCode, displayName: blueprint.component.displayName, componentType: blueprint.component.componentType },
    slots: blueprint.questionSlots.map((slot, index) => ({
      slotId: slot.id, number: index + 1, sectionId: slot.sectionId, sectionTitle: sections.get(slot.sectionId)?.label ?? slot.sectionId,
      marks: slot.targetMarks,
      curriculumTargets: slot.curriculumTargetIds.map((id) => {
        const topic = topics.get(id);
        if (!topic) throw new Error(`Blueprint slot ${slot.id} references unknown curriculum target ${id}.`);
        return { curriculumId: id, parentId: topic.parentId, parentName: topic.parentName, displayName: topic.displayName };
      }),
      questionFamily: slot.questionFamily, questionFamilyLabel: slot.questionFamilyLabel,
      allowedType: QUESTION_FAMILY_TO_AI_TYPE[slot.questionFamily], cognitiveDemand: slot.cognitiveDemand, constraints: [...slot.constraints],
    })),
  };
}

export function buildPrompt(params: GenerateExamCoreParams): string {
  const projection = projectBlueprint(params.blueprint);
  const outcomes = params.topics.map((topic) => ({ curriculumDisplayName: topic.subStrandName, parentDisplayName: topic.strandName, outcomeScope: topic.outcomeScope, outcomes: topic.outcomes }));
  return `Create the content for a ${params.difficulty} ${params.examType} for ${params.gradeName} (${params.level}) ${params.subjectName}.
The supplied generation blueprint is immutable and authoritative. Fill every slot exactly once. Do not invent, delete, reorder, resize, rename, or move slots or sections. Copy IDs, number, marks, questionFamily, type, cognitiveDemand, constraints, curriculum IDs and display names exactly. The question text must genuinely satisfy the family, cognitive demand, component, and every constraint. Acknowledging a constraint without satisfying it is invalid. Practical content must be safe, age-appropriate, teacher-reviewed, and must not introduce dangerous or unsupported procedures.
SELF-CONTAINED QUESTIONS: write the actual executable student-facing task, never a description or template. Include every value, formula, condition, context, passage, or datum needed to answer it. Never say "solve a problem involving", "given its percentage composition", "using the data provided", or similar unless the actual problem, percentages, or data immediately appear in the question text.
SUPPORTED CONTENT: the renderer displays only plain text and multiple-choice options. It does not render graphs, charts, diagrams, images, figures, stimulus tables, maps, source extracts, passages, case studies, datasets, or experiment-setup illustrations. Do not ask learners to interpret, study, refer to, or use any such missing resource. Convert necessary information into explicit inline prose, values, or coordinate/data pairs. Asking a learner to draw their own graph from inline values is permitted.
CALCULATIONS: create a concrete solvable problem. Supply usable numerical values and units, percentage composition, chemical formula, constants, equations, and conditions such as STP/RTP whenever needed. Symbolic problems are allowed when genuinely solvable symbolically.
SCOPE: fit the work to the immutable slot marks. A small-mark question must ask for a small, countable set of facts or steps. Do not ask for all properties, every method, or several broad tasks in a low-mark slot.
${params.textbookName ? `Style reference only; do not copy: ${params.textbookName}\n` : ""}GENERATION_BLUEPRINT=${JSON.stringify(projection)}
CURRICULUM_OUTCOMES=${JSON.stringify(outcomes)}
For every question return slotId, number, sectionId, curriculumIds, topic, text, marks, questionFamily, type, cognitiveDemand, constraintAcknowledgements, and options only for objective questions. Objective questions require exactly four plausible mutually exclusive options and one defensible answer.
For every marking entry return the same slotId and number, answer, marking_notes, marks, and non-empty allocations of {label,marks}. The answer must be substantive, not meta-language such as "we need to know", "use the formula", or "the answer should include". Allocation labels must state concrete awardable facts, steps, substitutions, results, units, observations, or explanations—not "correct answer", "working", or "method". For numerical tasks show applicable working, result, and unit where appropriate. Never invent facts about an absent resource. Allocation marks must sum exactly to the slot marks.
Return ONLY JSON shaped as {"instructions":string,"sections":[{"id":string,"title":string,"questions":[...]}],"marking_scheme":[...]}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch {
    const start = trimmed.indexOf("{"); const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("AI response did not contain JSON.");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
export function isValidGeneratedExam(value: unknown): value is GeneratedExam {
  if (!isRecord(value) || typeof value.instructions !== "string" || !Array.isArray(value.sections) || value.sections.length === 0 || !Array.isArray(value.marking_scheme)) return false;
  const sectionsValid = value.sections.every((section) => isRecord(section) && (section.id === undefined || typeof section.id === "string") && typeof section.title === "string" && Array.isArray(section.questions) && section.questions.every((question) =>
    isRecord(question) && typeof question.slotId === "string" && Number.isInteger(question.number) && typeof question.sectionId === "string" && strings(question.curriculumIds) &&
    typeof question.topic === "string" && typeof question.text === "string" && question.text.trim().length > 0 && Number.isInteger(question.marks) && typeof question.questionFamily === "string" &&
    typeof question.type === "string" && typeof question.cognitiveDemand === "string" && strings(question.constraintAcknowledgements) && (question.options === undefined || strings(question.options))));
  const markingValid = value.marking_scheme.every((entry) => isRecord(entry) && typeof entry.slotId === "string" && Number.isInteger(entry.number) && typeof entry.answer === "string" &&
    entry.answer.trim().length > 0 && typeof entry.marking_notes === "string" && Number.isInteger(entry.marks) && Array.isArray(entry.allocations) && entry.allocations.length > 0 &&
    entry.allocations.every((allocation) => isRecord(allocation) && typeof allocation.label === "string" && allocation.label.trim().length > 0 && Number.isInteger(allocation.marks) && (allocation.marks as number) > 0));
  return sectionsValid && markingValid;
}
function same(actual: string[], expected: string[]): boolean { return actual.length === expected.length && actual.every((value, index) => value === expected[index]); }

export function describeViolations(exam: GeneratedExam, blueprint: ExamBlueprint): string[] {
  const projection = projectBlueprint(blueprint); const violations: string[] = [];
  const questions = exam.sections.flatMap((section) => section.questions.map((question) => ({ section, question })));
  const expectedSections = [...new Map(projection.slots.map((slot) => [slot.sectionId, slot.sectionTitle])).entries()];
  if (exam.sections.length !== expectedSections.length) violations.push(`section count is ${exam.sections.length}, expected ${expectedSections.length}`);
  exam.sections.forEach((section, index) => {
    const expected = expectedSections[index];
    if (!expected || section.id !== expected[0] || section.title !== expected[1]) violations.push(`section at position ${index + 1} has wrong ID, title, or order`);
  });
  const sectionIds = exam.sections.map((section) => section.id);
  if (new Set(sectionIds).size !== sectionIds.length) violations.push("duplicate section IDs");
  const expectedIds = new Set(projection.slots.map((slot) => slot.slotId)); const counts = new Map<string, number>();
  for (const { question } of questions) counts.set(question.slotId, (counts.get(question.slotId) ?? 0) + 1);
  for (const slot of projection.slots) { const count = counts.get(slot.slotId) ?? 0; if (!count) violations.push(`missing question slot ${slot.slotId}`); if (count > 1) violations.push(`duplicate question slot ${slot.slotId}`); }
  for (const id of counts.keys()) if (!expectedIds.has(id)) violations.push(`extra question slot ${id}`);
  if (questions.length !== projection.slots.length) violations.push(`question count is ${questions.length}, expected ${projection.slots.length}`);
  questions.forEach(({ section, question }, index) => {
    const slot = projection.slots.find((candidate) => candidate.slotId === question.slotId); if (!slot) return;
    if (index + 1 !== slot.number || question.number !== slot.number) violations.push(`${slot.slotId} has wrong number/order`);
    if (section.id !== slot.sectionId || question.sectionId !== slot.sectionId || section.title !== slot.sectionTitle) violations.push(`${slot.slotId} has wrong section`);
    if (question.marks !== slot.marks) violations.push(`${slot.slotId} has ${question.marks} marks, expected ${slot.marks}`);
    const ids = slot.curriculumTargets.map((target) => target.curriculumId);
    if (!same(question.curriculumIds, ids) || !slot.curriculumTargets.some((target) => target.displayName === question.topic)) violations.push(`${slot.slotId} has wrong curriculum/topic identity`);
    if (question.questionFamily !== slot.questionFamily || question.type !== slot.allowedType) violations.push(`${slot.slotId} has incompatible question family/type`);
    if (question.cognitiveDemand !== slot.cognitiveDemand) violations.push(`${slot.slotId} has wrong cognitive demand`);
    if (!same(question.constraintAcknowledgements, slot.constraints)) violations.push(`${slot.slotId} does not acknowledge its exact component/practical/safety constraints`);
    if (question.type === "objective" && question.options?.length !== 4) violations.push(`${slot.slotId} objective question must have exactly four options`);
    if (question.type !== "objective" && question.options !== undefined) violations.push(`${slot.slotId} must not include options`);
  });
  const questionTotal = questions.reduce((sum, item) => sum + item.question.marks, 0);
  if (questionTotal !== projection.totalMarks) violations.push(`exam total is ${questionTotal}, expected ${projection.totalMarks}`);
  const markingCounts = new Map<string, number>();
  for (const entry of exam.marking_scheme) markingCounts.set(entry.slotId ?? "", (markingCounts.get(entry.slotId ?? "") ?? 0) + 1);
  for (const slot of projection.slots) { const count = markingCounts.get(slot.slotId) ?? 0; if (!count) violations.push(`missing marking entry for ${slot.slotId}`); if (count > 1) violations.push(`duplicate marking entry for ${slot.slotId}`); }
  for (const id of markingCounts.keys()) if (!expectedIds.has(id)) violations.push(`extra marking entry for ${id || "missing slotId"}`);
  for (const entry of exam.marking_scheme) {
    const slot = projection.slots.find((candidate) => candidate.slotId === entry.slotId); if (!slot) continue;
    if (entry.number !== slot.number) violations.push(`marking entry ${slot.slotId} has wrong number`);
    if (entry.marks !== slot.marks) violations.push(`marking entry ${slot.slotId} has ${entry.marks} marks, expected ${slot.marks}`);
    const allocated = entry.allocations?.reduce((sum, allocation) => sum + allocation.marks, 0) ?? 0;
    if (allocated !== slot.marks) violations.push(`marking allocations for ${slot.slotId} total ${allocated}, expected ${slot.marks}`);
  }
  const markingTotal = exam.marking_scheme.reduce((sum, entry) => sum + (entry.marks ?? 0), 0);
  if (markingTotal !== projection.totalMarks) violations.push(`marking scheme total is ${markingTotal}, expected ${projection.totalMarks}`);
  return [...new Set([...violations, ...describeSemanticViolations(exam)])];
}

export type Completion = (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) => Promise<string>;
export async function generateExamWithCompletion(params: GenerateExamCoreParams, complete: Completion): Promise<GeneratedExam> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [{ role: "system", content: "You are an experienced Kenyan curriculum exam setter. Return one valid JSON object only." }, { role: "user", content: buildPrompt(params) }];
  let lastProblems = ["unknown invalid response"];
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await complete(messages);
    try {
      const parsed = extractJson(raw);
      if (!isValidGeneratedExam(parsed)) lastProblems = ["response does not match the required schema"];
      else { lastProblems = describeViolations(parsed, params.blueprint); if (!lastProblems.length) return parsed; }
    } catch (error) { lastProblems = [error instanceof Error ? error.message : "response is not valid JSON"]; }
    if (!attempt) { messages.push({ role: "assistant", content: raw }); messages.push({ role: "user", content: `Correct every problem without changing the immutable blueprint: ${lastProblems.join("; ")}. Return the complete corrected JSON only.` }); }
  }
  throw new Error(`The AI could not produce a blueprint-aligned exam after 2 attempts: ${lastProblems.join("; ")}. Please try again.`);
}
