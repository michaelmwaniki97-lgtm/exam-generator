import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const action = readFileSync(new URL("../../app/actions/exam-editor.ts", import.meta.url), "utf8");
const grounding = readFileSync(new URL("./regeneration-grounding.ts", import.meta.url), "utf8");

test("server actions authenticate, derive teacher identity, and enforce ownership", () => {
  assert.match(action, /auth\.getUser\(\)/);
  assert.match(action, /from\("teachers"\).*eq\("user_id", user\.id\)/);
  assert.match(action, /exam\.teacher_id !== teacherId/);
  assert.match(action, /status === "paid".*status === "downloaded"/);
  assert.match(action, /saveExamEdits\(examId: string, expectedRevision: number, inputs: EditableSlotInput\[\]\)/);
  assert.match(action, /regenerateExamQuestion\(examId: string, slotId: string, expectedRevision: number\)/);
});

test("every save and regeneration mutation uses the atomic revision RPC", () => {
  assert.equal((action.match(/update_exam_and_scheme_atomic/g) ?? []).length, 1);
  assert.match(action, /p_expected_revision: expectedRevision/);
  assert.match(action, /saveExamEdits[\s\S]*return persist/);
  assert.match(action, /regenerateExamQuestion[\s\S]*return persist/);
});

test("regeneration grounding is pinned to canonical textbook, document, class, and subject", () => {
  assert.match(grounding, /input\.provenance\.textbookId/);
  assert.match(grounding, /eq\("subject_id", input\.subjectId\)/);
  assert.match(grounding, /eq\("grade_id", input\.gradeId\)/);
  assert.match(grounding, /eq\("id", documentId\).*eq\("textbook_id", textbook\.id\).*eq\("processing_status", "ready"\)/);
  assert.match(grounding, /documentId: document\.id/);
});
