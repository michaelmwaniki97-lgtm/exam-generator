import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ExamBlueprint } from "../blueprint/types.ts";
import type { GeneratedExam } from "../ai/generation-core.ts";
import { applyEditableChanges, INVALID_STORED_CONTENT_MESSAGE, materiallyDuplicates, replaceOneSlot, storedContentForDisplayOrThrow, type StoredExamContent, type StoredMarkingContent } from "./core.ts";
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
function inputs(value = stored()) { const { exam, marking } = value; const entries = new Map(marking.entries.map((entry) => [entry.slotId, entry])); return exam.sections.flatMap((section) => section.questions.map((question) => { const entry = entries.get(question.slotId)!; return { slotId: question.slotId, questionText: question.text, ...(question.options ? { options: [...question.options] } : {}), answer: entry.answer ?? entry.numericalMethod?.finalAnswer ?? "", markingNotes: entry.marking_notes, allocationLabels: (entry.allocations ?? []).map((allocation) => allocation.label), rubricDescriptors: (entry.rubric ?? []).map((criterion) => criterion.descriptor) }; })); }
function historical() {
  const value = stored();
  value.marking.entries[0].marking_notes = "The answer should include the correct method.";
  value.exam.sections[0].questions[1].text = "Solve a problem involving separation of mixtures.";
  value.marking.entries[1].marking_notes = "The answer should include the correct method.";
  value.marking.entries[1].answer = value.exam.sections[0].questions[1].text;
  value.marking.entries[1].allocations![0].label = "Method";
  return value;

}
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
    calls++; assert.match(messages[1].content, /methodSteps\[\]\.marks/); assert.doesNotMatch(messages[1].content, /methodMarks/); const question = structuredClone(value.exam.sections[0].questions[0]); const entry = structuredClone(value.marking.entries[0]);
    if (calls === 1) question.marks = 99; else { question.text = "Which method separates chalk from water?"; entry.allocations![0].label = "Selects filtration for insoluble chalk"; assert.match(messages.at(-1)!.content, /99 marks/); }
    return JSON.stringify({ question, marking_entry: entry });
  });
  assert.equal(calls, 2); assert.equal(result.exam.sections[0].questions[0].text, "Which method separates chalk from water?"); assert.deepEqual(result.exam.sections[0].questions[1], value.exam.sections[0].questions[1]);
});
test("migration grants only service role and implements lock/revision/atomic pair", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260823150000_add_exam_editor_atomic_updates.sql", import.meta.url), "utf8");
  assert.match(sql, /add column revision integer not null default 1/); assert.match(sql, /for update/); assert.match(sql, /v_exam\.teacher_id <> p_teacher_id/); assert.match(sql, /v_exam\.revision <> p_expected_revision/); assert.match(sql, /status in \('paid', 'downloaded'\)/); assert.match(sql, /update public\.marking_schemes/); assert.match(sql, /revision = revision \+ 1/); assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/); assert.match(sql, /grant execute[\s\S]*to service_role/); assert.doesNotMatch(sql, /security definer/i);
});

test("question punctuation edit ignores and exactly preserves historical generic marking notes", () => {
  const value = historical();
  const legacyQuestion = value.exam.sections[0].questions[1];
  const legacyQuestionEntry = value.marking.entries[0];
  const unrelatedLegacyEntry = value.marking.entries[1];
  const editable = inputs(value);
  editable[0].questionText = "Which method separates sand from water";
  const next = applyEditableChanges(value.exam, value.marking, editable);
  assert.deepEqual(next.changedSlotIds, ["slot-01"]);
  assert.equal(next.exam.sections[0].questions[0].text, editable[0].questionText);
  assert.strictEqual(next.marking.entries[0], legacyQuestionEntry);
  assert.strictEqual(next.exam.sections[0].questions[1], legacyQuestion);
  assert.strictEqual(next.marking.entries[1], unrelatedLegacyEntry);
});

test("editing a historically invalid question applies current semantic rules to that slot", () => {
  const value = historical();
  const editable = inputs(value);
  editable[1].questionText = "Solve a problem involving filtration of a mixture.";
  assert.throws(() => applyEditableChanges(value.exam, value.marking, editable), /Edited content.*no actual problem or usable givens/);
});

test("changed marking content receives current semantic validation without validating unrelated legacy slots", () => {
  const value = historical();
  const valid = inputs(value);
  valid[0].answer = "Filtration separates the insoluble solid from water.";
  assert.doesNotThrow(() => applyEditableChanges(value.exam, value.marking, valid));
  const invalid = inputs(value);
  invalid[0].allocationLabels[0] = "Method";
  assert.throws(() => applyEditableChanges(value.exam, value.marking, invalid), /generic allocation label/);
});

test("manual compatibility still validates the complete canonical structure", () => {
  const value = historical();
  value.exam.sections[0].questions[1].marks = 3;
  const editable = inputs(value);
  editable[0].questionText = "Which process separates insoluble chalk from water?";
  assert.throws(() => applyEditableChanges(value.exam, value.marking, editable), /slot-02 has 3 marks, expected 2/);
});

test("marking-notes-only edit ignores an unchanged historical question defect", () => {
  const value = historical();
  const legacyQuestion = value.exam.sections[0].questions[1];
  const editable = inputs(value);
  editable[1].markingNotes = "Award one mark for identifying filtration and one for explaining why it separates an insoluble solid.";
  const next = applyEditableChanges(value.exam, value.marking, editable);
  assert.deepEqual(next.changedSlotIds, ["slot-02"]);
  assert.strictEqual(next.exam.sections[0].questions[1], legacyQuestion);
  assert.equal(next.marking.entries[1].marking_notes, editable[1].markingNotes);
});

test("new generic marking notes are rejected even when the question is unchanged", () => {
  const value = stored();
  const editable = inputs(value);
  editable[0].markingNotes = "The answer should include the correct method.";
  assert.throws(() => applyEditableChanges(value.exam, value.marking, editable), /generic marking notes/);
});

test("question and marking edits validate both changed sides", () => {
  const value = stored();
  const editable = inputs(value);
  editable[1].questionText = "Solve a problem involving filtration.";
  editable[1].markingNotes = "The answer should include the correct method.";
  assert.throws(
    () => applyEditableChanges(value.exam, value.marking, editable),
    (error: unknown) => error instanceof Error &&
      /no actual problem or usable givens/.test(error.message) &&
      /generic marking notes/.test(error.message)
  );
});

test("AI regeneration keeps full semantic validation for question and marking content", () => {
  const value = stored();
  const replacement = structuredClone(value.exam.sections[0].questions[0]);
  const entry = structuredClone(value.marking.entries[0]);
  replacement.text = "Which process separates chalk from water?";
  entry.marking_notes = "The answer should include the correct method.";
  assert.throws(
    () => replaceOneSlot(value.exam, value.marking, "slot-01", replacement, entry),
    /generic marking notes/
  );
});

test("valid target regeneration ignores unrelated historical semantic defects", async () => {
  const value = historical();
  const legacyQuestion = value.exam.sections[0].questions[1];
  const legacyEntry = value.marking.entries[1];
  const question = structuredClone(value.exam.sections[0].questions[0]);
  const entry = structuredClone(value.marking.entries[0]);
  question.text = "Which method separates insoluble chalk from water?";
  entry.marking_notes = "Award the mark for identifying filtration.";
  entry.allocations![0].label = "Identifies filtration";
  let calls = 0;
  const result = await regenerateSlotWithCompletion(
    { exam: value.exam, marking: value.marking, blueprint: blueprint(), slotId: "slot-01", subjectName: "Chemistry", gradeName: "Form 3", examType: "Test", difficulty: "medium" },
    async () => { calls++; return JSON.stringify({ question, marking_entry: entry }); }
  );
  assert.equal(calls, 1);
  assert.equal(result.exam.sections[0].questions[0].text, question.text);
  assert.strictEqual(result.exam.sections[0].questions[1], legacyQuestion);
  assert.strictEqual(result.marking.entries[1], legacyEntry);
});

test("invalid regenerated question retries with target-only violations and preserves the original", async () => {
  const value = historical();
  const originalExam = structuredClone(value.exam);
  const originalMarking = structuredClone(value.marking);
  const question = structuredClone(value.exam.sections[0].questions[0]);
  const entry = structuredClone(value.marking.entries[0]);
  question.text = "Solve a problem involving filtration.";
  entry.marking_notes = "Award the mark for identifying filtration.";
  entry.allocations![0].label = "Identifies filtration";
  let calls = 0;
  await assert.rejects(
    regenerateSlotWithCompletion(
      { exam: value.exam, marking: value.marking, blueprint: blueprint(), slotId: "slot-01", subjectName: "Chemistry", gradeName: "Form 3", examType: "Test", difficulty: "medium" },
      async (messages) => {
        calls++;
        if (calls === 2) {
          const correction = messages.at(-1)!.content;
          assert.match(correction, /slot-01.*no actual problem or usable givens/);
          assert.doesNotMatch(correction, /slot-02/);
        }
        return JSON.stringify({ question, marking_entry: entry });
      }
    ),
    /regenerated target.*slot-01.*no actual problem or usable givens/
  );
  assert.equal(calls, 2);
  assert.deepEqual(value.exam, originalExam);
  assert.deepEqual(value.marking, originalMarking);
});

test("invalid regenerated marking entry remains fully strict", async () => {
  const value = historical();
  const question = structuredClone(value.exam.sections[0].questions[0]);
  const entry = structuredClone(value.marking.entries[0]);
  question.text = "Which method separates insoluble chalk from water?";
  entry.marking_notes = "The answer should include the correct method.";
  await assert.rejects(
    regenerateSlotWithCompletion(
      { exam: value.exam, marking: value.marking, blueprint: blueprint(), slotId: "slot-01", subjectName: "Chemistry", gradeName: "Form 3", examType: "Test", difficulty: "medium" },
      async () => JSON.stringify({ question, marking_entry: entry })
    ),
    /regenerated target.*generic marking notes/
  );
});

function richStored() {
  const value = stored();
  const slot = value.exam.meta.blueprint!.questionSlots[0];
  slot.questionFamily = "comprehension"; slot.questionFamilyLabel = "Comprehension"; slot.allowedStimulusTypes = ["passage"]; slot.allowedMarkingModels = ["point_based"];
  const question = value.exam.sections[0].questions[0];
  question.questionFamily = "comprehension"; question.type = "comprehension"; question.text = "From the passage below, identify the method used to clean the water.";
  delete question.options;
  question.stimuli = [{ type: "passage", id: "passage-1", sourceType: "generated", content: "Amina poured the muddy water through a clean filter to remove insoluble particles." }];
  value.marking.entries[0].markingModel = "point_based";
  return value;
}

test("rich passage text edits persist while stimulus structure stays locked", () => {
  const value = richStored(); const editable = inputs(value);
  editable[0].stimulusTextEdits = [{ id: "passage-1", content: "Amina carefully filtered muddy water to remove insoluble particles." }];
  const next = applyEditableChanges(value.exam, value.marking, editable);
  assert.equal(next.exam.sections[0].questions[0].stimuli?.[0].type, "passage");
  assert.equal(next.exam.sections[0].questions[0].stimuli?.[0].content, editable[0].stimulusTextEdits[0].content);
});

test("structural rich-content tampering fails server-side", () => {
  const value = richStored(); const editable = inputs(value);
  editable[0].stimulusTextEdits = [{ id: "forged-stimulus", content: "Replacement" }];
  assert.throws(() => applyEditableChanges(value.exam, value.marking, editable), /stimulus structure cannot be changed/);
});

test("rubric descriptor edits preserve locked criteria and mark totals", () => {
  const value = stored(); const slot = value.exam.meta.blueprint!.questionSlots[1];
  slot.questionFamily = "creative_composition"; slot.allowedMarkingModels = ["composition_rubric"];
  const question = value.exam.sections[0].questions[1]; question.questionFamily = "creative_composition"; question.type = "extended_response"; question.text = "Write a short composition about conserving water.";
  value.marking.entries[1] = { slotId: "slot-02", number: 2, markingModel: "composition_rubric", marking_notes: "Apply the school rubric consistently.", marks: 2, rubric: [{ criterion: "Content and language", descriptor: "Develops relevant ideas using clear language.", marks: 2 }] };
  const editable = inputs(value); editable[1].rubricDescriptors = ["Develops relevant water-conservation ideas using coherent and accurate language."];
  const next = applyEditableChanges(value.exam, value.marking, editable);
  assert.equal(next.marking.entries[1].rubric?.[0].marks, 2);
  assert.equal(next.marking.entries[1].rubric?.[0].criterion, "Content and language");
  assert.equal(next.marking.entries[1].rubric?.[0].descriptor, editable[1].rubricDescriptors[0]);
});

test("regenerating a rich question changes only its owned question, stimulus and scheme", () => {
  const value = richStored(); const question = structuredClone(value.exam.sections[0].questions[0]); const entry = structuredClone(value.marking.entries[0]);
  question.text = "From the passage below, name the separation method Amina used.";
  question.stimuli![0] = { type: "passage", id: "passage-2", sourceType: "generated", content: "Amina passed the mixture through filter paper and collected clear water." };
  entry.answer = "Filtration."; entry.allocations![0].label = "Identifies filtration from the passage";
  const untouchedQuestion = structuredClone(value.exam.sections[0].questions[1]); const untouchedEntry = structuredClone(value.marking.entries[1]);
  const next = replaceOneSlot(value.exam, value.marking, "slot-01", question, entry);
  assert.deepEqual(next.exam.sections[0].questions[1], untouchedQuestion); assert.deepEqual(next.marking.entries[1], untouchedEntry);
  assert.deepEqual(next.exam.sections[0].questions[0].stimuli, question.stimuli);
});

test("stored-content boundary accepts legacy and valid rich exams", () => {
  const legacy = stored(); assert.equal(storedContentForDisplayOrThrow(legacy.exam, legacy.marking).exam.sections.length, 1);
  const rich = richStored(); assert.equal(storedContentForDisplayOrThrow(rich.exam, rich.marking).exam.sections[0].questions[0].stimuli?.[0].type, "passage");
});

test("malformed stored stimulus types, graphs and diagrams fail with a controlled message", () => {
  const cases = [
    { type: "image", id: "bad", src: "https://example.test/x" },
    { type: "graph", id: "bad", graphType: "line", xAxis: null, yAxis: {}, series: null },
    { type: "diagram", id: "bad", width: 100, height: 100, primitives: [{ type: "foreignObject" }] },
  ];
  for (const stimulus of cases) {
    const value = stored(); value.exam.sections[0].questions[0].stimuli = [stimulus as never];
    assert.throws(() => storedContentForDisplayOrThrow(value.exam, value.marking), (error: unknown) => error instanceof Error && error.message === INVALID_STORED_CONTENT_MESSAGE && !error.message.includes(JSON.stringify(stimulus)));
  }
});

test("malformed stored rubric fails safely and cannot be saved back", () => {
  const value = stored(); value.marking.entries[0].markingModel = "composition_rubric"; value.marking.entries[0].rubric = [{ criterion: "Ideas", descriptor: "Relevant ideas", marks: 99 }]; delete value.marking.entries[0].answer; delete value.marking.entries[0].allocations;
  assert.throws(() => storedContentForDisplayOrThrow(value.exam, value.marking), new RegExp(INVALID_STORED_CONTENT_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.throws(() => applyEditableChanges(value.exam, value.marking, inputs(value)), /unsupported or invalid stored content/);
});
