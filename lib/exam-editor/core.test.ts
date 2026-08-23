import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ExamBlueprint } from "../blueprint/types.ts";
import type { GeneratedExam } from "../ai/generation-core.ts";
import { applyEditableChanges, materiallyDuplicates, replaceOneSlot, type StoredExamContent, type StoredMarkingContent } from "./core.ts";
import { regenerateSlotWithCompletion } from "./regeneration-core.ts";

function blueprint(): ExamBlueprint {
  return { blueprintVersion: 1, totalMarks: 3, durationMinutes: 20, component: null,
    sections: [{ id: "section-01", label: "Section A", slotIds: ["slot-01", "slot-02"] }],
    topicAllocations: [{ curriculumId: "topic-a", parentId: "parent-a", parentName: "Matter", displayName: "Mixtures" }],
    questionSlots: [
      { id: "slot-01", sectionId: "section-01", targetMarks: 1, questionFamily: "objective", questionFamilyLabel: "Objective", curriculumTargetIds: ["topic-a"], cognitiveDemand: "FOUNDATIONAL", constraints: [] },
      { id: "slot-02", sectionId: "section-01", targetMarks: 2, questionFamily: "short_response", questionFamilyLabel: "Short response", curriculumTargetIds: ["topic-a"], cognitiveDemand: "APPLICATION", constraints: [] },
    ] } as unknown as ExamBlueprint;
}
function generated(): GeneratedExam {
  return { instructions: "Answer all questions.", sections: [{ id: "section-01", title: "Section A", questions: [
    { slotId: "slot-01", number: 1, sectionId: "section-01", curriculumIds: ["topic-a"], topic: "Mixtures", text: "Which method separates sand from water?", marks: 1, questionFamily: "objective", type: "objective", cognitiveDemand: "FOUNDATIONAL", constraintAcknowledgements: [], options: ["Filtration", "Evaporation", "Distillation", "Chromatography"] },
    { slotId: "slot-02", number: 2, sectionId: "section-01", curriculumIds: ["topic-a"], topic: "Mixtures", text: "Explain two reasons for separating mixtures.", marks: 2, questionFamily: "short_response", type: "short_answer", cognitiveDemand: "APPLICATION", constraintAcknowledgements: [] },
  ] }], marking_scheme: [
    { slotId: "slot-01", number: 1, answer: "Filtration.", marking_notes: "Accept filtration only.", marks: 1, allocations: [{ label: "Selects filtration", marks: 1 }] },
    { slotId: "slot-02", number: 2, answer: "Separation removes harmful impurities and recovers useful materials.", marking_notes: "Award one mark for each explained reason.", marks: 2, allocations: [{ label: "Explains removal of harmful impurities", marks: 1 }, { label: "Explains recovery of useful materials", marks: 1 }] },
  ] };
}
function stored() { const value = generated(); return { exam: { instructions: value.instructions, sections: value.sections, meta: { blueprint: blueprint(), preserved: "yes" } } as StoredExamContent, marking: { entries: value.marking_scheme } as StoredMarkingContent }; }
function inputs() { const { exam, marking } = stored(); const entries = new Map(marking.entries.map((entry) => [entry.slotId, entry])); return exam.sections.flatMap((section) => section.questions.map((question) => { const entry = entries.get(question.slotId)!; return { slotId: question.slotId, questionText: question.text, ...(question.options ? { options: [...question.options] } : {}), answer: entry.answer, markingNotes: entry.marking_notes, allocationLabels: entry.allocations!.map((allocation) => allocation.label) }; })); }

test("content edits preserve every structural field, allocation mark, and metadata", () => {
  const before = stored(); const editable = inputs(); editable[0].questionText = "Which technique separates insoluble sand from water?"; editable[0].answer = "Filtration separates the insoluble sand."; editable[0].allocationLabels[0] = "Identifies filtration";
  const next = applyEditableChanges(before.exam, before.marking, editable);
  assert.equal(next.exam.sections[0].questions[0].text, editable[0].questionText);
  assert.deepEqual({ ...next.exam.sections[0].questions[0], text: before.exam.sections[0].questions[0].text, options: before.exam.sections[0].questions[0].options }, before.exam.sections[0].questions[0]);
  assert.equal(next.marking.entries[0].allocations![0].marks, 1); assert.equal(next.exam.meta.preserved, "yes");
});
test("empty content, forged slots, and malformed MCQ options are rejected", () => {
  const value = stored(); const empty = inputs(); empty[0].questionText = " "; assert.throws(() => applyEditableChanges(value.exam, value.marking, empty), /cannot be empty/);
  const forged = inputs(); forged[0].slotId = "forged"; assert.throws(() => applyEditableChanges(value.exam, value.marking, forged), /does not match/);
  const options = inputs(); options[0].options = ["Same", "Same", "Other", "Fourth"]; assert.throws(() => applyEditableChanges(value.exam, value.marking, options), /distinct/);
});
test("one-slot replacement leaves all other questions and marking entries unchanged", () => {
  const value = stored(); const replacement = structuredClone(value.exam.sections[0].questions[0]); replacement.text = "Which method separates chalk from water?";
  const entry = structuredClone(value.marking.entries[0]); entry.answer = "Filtration."; entry.allocations![0].label = "Selects filtration for insoluble chalk";
  const next = replaceOneSlot(value.exam, value.marking, "slot-01", replacement, entry);
  assert.deepEqual(next.exam.sections[0].questions[1], value.exam.sections[0].questions[1]); assert.deepEqual(next.marking.entries[1], value.marking.entries[1]);
});
test("material duplication is rejected deterministically", () => { assert.equal(materiallyDuplicates("Explain why separating harmful impurities from water protects health", ["Explain why separating harmful impurities from water protects health"]), true); });
test("regeneration uses at most one corrective retry and reuses full Phase 6 validation", async () => {
  const value = stored(); let calls = 0;
  const result = await regenerateSlotWithCompletion({ exam: value.exam, marking: value.marking, blueprint: blueprint(), slotId: "slot-01", subjectName: "Chemistry", gradeName: "Form 3", examType: "Test", difficulty: "medium" }, async (messages) => {
    calls++; const question = structuredClone(value.exam.sections[0].questions[0]); const entry = structuredClone(value.marking.entries[0]);
    if (calls === 1) question.marks = 99; else { question.text = "Which method separates chalk from water?"; entry.allocations![0].label = "Selects filtration for insoluble chalk"; assert.match(messages.at(-1)!.content, /99 marks/); }
    return JSON.stringify({ question, marking_entry: entry });
  });
  assert.equal(calls, 2); assert.equal(result.exam.sections[0].questions[0].text, "Which method separates chalk from water?"); assert.deepEqual(result.exam.sections[0].questions[1], value.exam.sections[0].questions[1]);
});
test("migration grants only service role and implements lock/revision/atomic pair", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260823150000_add_exam_editor_atomic_updates.sql", import.meta.url), "utf8");
  assert.match(sql, /add column revision integer not null default 1/); assert.match(sql, /for update/); assert.match(sql, /v_exam\.teacher_id <> p_teacher_id/); assert.match(sql, /v_exam\.revision <> p_expected_revision/); assert.match(sql, /status in \('paid', 'downloaded'\)/); assert.match(sql, /update public\.marking_schemes/); assert.match(sql, /revision = revision \+ 1/); assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/); assert.match(sql, /grant execute[\s\S]*to service_role/); assert.doesNotMatch(sql, /security definer/i);
});
