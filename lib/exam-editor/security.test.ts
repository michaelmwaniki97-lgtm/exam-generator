import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const action = readFileSync(new URL("../../app/actions/exam-editor.ts", import.meta.url), "utf8");
const examReadFactory = readFileSync(new URL("../exam-read/index.ts", import.meta.url), "utf8");
const postgresExamRead = readFileSync(new URL("../exam-read/postgres.ts", import.meta.url), "utf8");
const grounding = readFileSync(new URL("./regeneration-grounding.ts", import.meta.url), "utf8");
const richRenderer = readFileSync(new URL("../../components/exam-content/rich-stimuli.tsx", import.meta.url), "utf8");
const examView = readFileSync(new URL("../../app/teacher/exams/[id]/page.tsx", import.meta.url), "utf8");
const markingView = readFileSync(new URL("../../app/teacher/exams/[id]/marking-scheme/page.tsx", import.meta.url), "utf8");
const documentLoader = readFileSync(new URL("../exam-document/load.ts", import.meta.url), "utf8");
const documentModel = readFileSync(new URL("../exam-document/model.ts", import.meta.url), "utf8");

test("server actions authenticate, derive teacher identity, and enforce ownership", () => {
  assert.match(action, /getTeacherExamReadContext\(\)/);
  assert.match(examReadFactory, /supabase\.auth\.getUser\(\)/);
  assert.match(examReadFactory, /from\("teachers"\).*eq\("user_id", user\.id\)/);
  assert.match(examReadFactory, /new PostgresExamReadRepository\(user\.id, teacher\.id\)/);
  assert.match(postgresExamRead, /where id = \$1::uuid and teacher_id = \$2::uuid/);
  assert.match(postgresExamRead, /ms\.exam_id = \$1::uuid and e\.teacher_id = \$2::uuid/);
  assert.doesNotMatch(examReadFactory + action, /request\.json|headers\(|cookies\(|userId\s*:/);
  assert.match(action, /status === "paid".*status === "downloaded"/);
  assert.match(action, /saveExamEdits\(examId: string, expectedRevision: number, inputs: EditableSlotInput\[\]\)/);
  assert.match(action, /regenerateExamQuestion\(examId: string, slotId: string, expectedRevision: number, requestId: string\)/);
});

test("regeneration authorization and reservation claim precede provider work", () => {
  const regeneration = action.slice(action.indexOf("export async function regenerateExamQuestion"));
  const canonicalLoad = regeneration.indexOf("await loadCanonical(examId)");
  const lease = regeneration.indexOf("await claimQuestionRegeneration");
  const groundingWork = regeneration.indexOf("await prepareRegenerationGrounding");
  const providerWork = regeneration.indexOf("await regenerateQuestion");
  assert.ok(canonicalLoad >= 0 && canonicalLoad < lease);
  assert.ok(lease < groundingWork && groundingWork < providerWork);
});

test("ordinary saves retain their typed atomic operation and regeneration uses its reservation-aware atomic operation", () => {
  assert.equal((action.match(/updateExamAndSchemeAtomic/g) ?? []).length, 1);
  assert.match(action, /updateExamAndSchemeAtomic\(\{ examId: exam\.id, teacherId, expectedRevision/);
  assert.match(action, /saveExamEdits[\s\S]*return persist/);
  assert.match(action, /regenerateExamQuestion[\s\S]*await persistRegeneratedQuestion/);
  assert.match(action, /regenerateExamQuestion[\s\S]*return \{ ok: true, revision \}/);
});

test("regeneration grounding is pinned to canonical textbook, document, class, and subject", () => {
  assert.match(grounding, /input\.provenance\.textbookId/);
  assert.match(grounding, /eq\("subject_id", input\.subjectId\)/);
  assert.match(grounding, /eq\("grade_id", input\.gradeId\)/);
  assert.match(grounding, /eq\("id", documentId\).*eq\("textbook_id", textbook\.id\).*eq\("processing_status", "ready"\)/);
  assert.match(grounding, /documentId: document\.id/);
});

test("rich content rendering uses only deterministic React and declarative SVG primitives", () => {
  assert.doesNotMatch(richRenderer, /dangerouslySetInnerHTML|href=|src=|foreignObject|fetch\(/);
  assert.match(richRenderer, /<table/); assert.match(richRenderer, /<svg/);
  assert.match(richRenderer, /stimulus\.primitives\.map/);
});

test("stored exam and marking views validate rich JSON and fail with a controlled message", () => {
  for (const source of [examView, markingView]) {
    assert.match(source, /loadCanonicalExamDocument/);
    assert.match(source, /unsupported or invalid stored content/);
    assert.match(source, /error instanceof ExamDocumentAccessError/);
    assert.match(source, /unexpected server error/);
    assert.doesNotMatch(source, /message:\s*error\.message/);
    assert.doesNotMatch(source, /JSON\.stringify\(exam\.content\)/);
  }
  assert.match(documentLoader, /buildExamDocument/);
  assert.match(documentLoader, /getDocumentAccessMetadata\(id\)/);
  assert.match(documentLoader, /getAuthorizedExamDocument\(id, kind === "marking"\)/);
  assert.ok(documentLoader.indexOf("getDocumentAccessMetadata(id)") < documentLoader.indexOf("getAuthorizedExamDocument(id"));
  assert.match(documentLoader, /error\.message === INVALID_STORED_CONTENT_MESSAGE/);
  assert.match(documentLoader, /throw error/);
  assert.match(documentModel, /storedContentForDisplayOrThrow/);
  assert.match(documentModel, /INVALID_STORED_CONTENT_MESSAGE/);
});

test("exam pages do not label unexpected loader failures as invalid stored content", () => {
  for (const source of [examView, markingView]) {
    const accessBranch = source.indexOf("if (error instanceof ExamDocumentAccessError)");
    const invalidContent = source.indexOf("unsupported or invalid stored content", accessBranch);
    const unexpectedBranch = source.indexOf("console.error", invalidContent);
    const retryMessage = source.indexOf("Please try again", unexpectedBranch);
    assert.ok(accessBranch >= 0);
    assert.ok(invalidContent > accessBranch);
    assert.ok(unexpectedBranch > invalidContent);
    assert.ok(retryMessage > unexpectedBranch);
  }
  assert.match(documentLoader, /error\.message === INVALID_STORED_CONTENT_MESSAGE/);
  assert.match(documentLoader, /throw error/);
});
