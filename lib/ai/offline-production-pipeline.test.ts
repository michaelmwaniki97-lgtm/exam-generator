import assert from "node:assert/strict";
import test from "node:test";
import { FinalExamValidationError, validateFinalStagedExam } from "./generate-exam.ts";
import { createOfflineProductionExam, offlineGrounding } from "./offline-production-pipeline.fixture.ts";

async function failure(mutator: (exam: Awaited<ReturnType<typeof createOfflineProductionExam>>["exam"]) => void) {
  const { exam, blueprint } = await createOfflineProductionExam();
  mutator(exam);
  try { validateFinalStagedExam(exam, blueprint, offlineGrounding); assert.fail("Expected final validation failure"); }
  catch (error) { assert.ok(error instanceof FinalExamValidationError); return error.diagnostics; }
}

test("16:08 rejected inline-data marking passes full six-question assembly and final validation", async () => {
  const { exam, blueprint } = await createOfflineProductionExam(true);
  assert.equal(exam.sections.flatMap(section => section.questions).length, 6);
  assert.equal(exam.marking_scheme.length, 6);
  assert.equal(exam.marking_scheme.reduce((sum, entry) => sum + (entry.marks ?? 0), 0), 30);
  assert.equal(exam.marking_scheme[2].numericalMethod?.finalAnswer, "18 pawpaws per day");
  assert.doesNotThrow(() => validateFinalStagedExam(exam, blueprint, offlineGrounding));
});

test("complete Grade 8 Mathematics 30-mark offline fixture traverses compact normalization, assembly, grounding and final validation", async () => {
  const { exam, blueprint } = await createOfflineProductionExam();
  assert.equal(exam.sections.flatMap((section) => section.questions).length, 6);
  assert.equal(exam.sections.flatMap((section) => section.questions).reduce((sum, question) => sum + question.marks, 0), 30);
  assert.equal(exam.marking_scheme.length, 6);
  assert.equal(exam.marking_scheme.reduce((sum, entry) => sum + (entry.marks ?? 0), 0), 30);
  assert.equal(exam.sections[0].questions[0].visual?.type, "graph");
  assert.match(exam.marking_scheme[0].answer ?? "", /graph/i);
  assert.doesNotThrow(() => validateFinalStagedExam(exam, blueprint, offlineGrounding));
});

test("marking-only semantic heuristics remain advisory at final validation", async () => {
  const { exam, blueprint } =
    await createOfflineProductionExam();

  // Structurally valid but deliberately heuristic-triggering wording.
  exam.marking_scheme[1].marking_notes =
    "Award marks according to the graph shown.";

  assert.doesNotThrow(() =>
    validateFinalStagedExam(
      exam,
      blueprint,
      offlineGrounding
    )
  );
});


test("final validation safely classifies every offline corruption category", async () => {
  assert.ok((await failure((exam) => { exam.sections[0].questions[0].marks = 4; })).categories.includes("question_mark_total_mismatch"));
  assert.ok((await failure((exam) => { exam.sections[0].questions.pop(); })).categories.includes("question_slot_mismatch"));
  assert.ok((await failure((exam) => { exam.marking_scheme[0].slotId = "slot-02"; })).categories.includes("marking_question_reference_mismatch"));
  assert.ok((await failure((exam) => { const visual = exam.sections[0].questions[0].visual!; if (visual.type === "graph") visual.specification.xAxis.min = visual.specification.xAxis.max; })).categories.includes("visual_data_mismatch"));
  assert.ok((await failure((exam) => { exam.sections[0].questions[1].stimuli = [{ type: "table", id: "invalid", columns: ["A"], rows: [["1"]] }]; })).categories.includes("stimulus_reference_mismatch"));
  assert.ok((await failure((exam) => { const stimulus = exam.sections[0].questions[5].stimuli?.[0]; if (stimulus && (stimulus.type === "passage" || stimulus.type === "extract")) stimulus.provenance!.chunkIds = ["forged"]; })).categories.includes("grounding_validation"));
});
