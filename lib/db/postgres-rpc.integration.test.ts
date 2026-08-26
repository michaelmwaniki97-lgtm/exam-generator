import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { getPostgresPool, queryRows, withAuthenticatedTransaction, withTrustedTransaction, closePostgresPool } from "./postgres-client.ts";
import { PostgresAuthenticatedRpcDatabase, PostgresTrustedRpcDatabase } from "./postgres-rpc.ts";

const USER_A = "00000000-0000-4000-8000-000000000006";
const USER_B = "00000000-0000-4000-8000-000000000001";
const SUBJECT = "10000000-0000-4000-8000-000000000001";
const GRADE = "10000000-0000-4000-8000-000000000002";
const TEXTBOOK = "20000000-0000-4000-8000-000000000001";
const DOCUMENT = "20000000-0000-4000-8000-000000000002";

test("direct PostgreSQL adapter preserves all 13 RPC contracts and identity boundaries", async (context) => {
  context.after(closePostgresPool);
  const trusted = new PostgresTrustedRpcDatabase();
  const authenticated = new PostgresAuthenticatedRpcDatabase(USER_A);
  const teacherA = await withTrustedTransaction(async (client) => (await queryRows<{ id: string }>(client, "select id from public.teachers where user_id = $1::uuid", [USER_A]))[0].id);
  const teacherB = await withTrustedTransaction(async (client) => (await queryRows<{ id: string }>(client, "select id from public.teachers where user_id = $1::uuid", [USER_B]))[0].id);

  await assert.rejects(() => trusted.importVerifiedCurriculum({ schema_version: 0 }), /Unsupported curriculum import payload schema version/);
  assert.equal((await authenticated.listReadyTextbooks({ subjectId: SUBJECT, gradeId: GRADE })).length, 1);

  const embedding = Array.from({ length: 2048 }, (_, index) => index === 0 ? 1 : 0);
  const chunks = await trusted.matchTextbookChunks({ textbookId: TEXTBOOK, documentId: DOCUMENT, queryEmbedding: embedding, limit: 3 });
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].chunk_id, "20000000-0000-4000-8000-000000000011");

  const generationKey = randomUUID();
  const generation = await trusted.claimAiGeneration({ teacherId: teacherA, requestKey: generationKey });
  assert.equal(generation[0].outcome, "acquired");
  const examId = await trusted.persistGeneratedExam({ teacherId: teacherA, reservationId: generation[0].reservation_id!, requestKey: generationKey, subjectId: SUBJECT, gradeId: GRADE, examType: "Adapter Integration", marks: 20, duration: 30, difficulty: "medium", term: "Term 1", year: 2026, examContent: { exam: "adapter" }, markingContent: { scheme: "adapter" } });

  const regenerationKey = randomUUID();
  const regeneration = await trusted.claimAiRegeneration({ teacherId: teacherA, examId, slotId: "slot-1", requestKey: regenerationKey, expectedRevision: 1 });
  assert.equal(regeneration[0].outcome, "acquired");
  assert.equal(await trusted.persistRegeneratedExam({ teacherId: teacherA, reservationId: regeneration[0].reservation_id!, requestKey: regenerationKey, examId, slotId: "slot-1", expectedRevision: 1, examContent: { exam: "regenerated" }, markingContent: { scheme: "regenerated" } }), 2);

  const failedKey = randomUUID();
  const failedClaim = await trusted.claimAiRegeneration({ teacherId: teacherA, examId, slotId: "slot-fail", requestKey: failedKey, expectedRevision: 2 });
  assert.equal(await trusted.failAiOperation({ teacherId: teacherA, reservationId: failedClaim[0].reservation_id! }), true);
  assert.equal(await trusted.updateExamAndSchemeAtomic({ examId, teacherId: teacherA, expectedRevision: 2, examContent: { exam: "edited" }, markingContent: { scheme: "edited" } }), 3);
  await assert.rejects(() => trusted.updateExamAndSchemeAtomic({ examId, teacherId: teacherB, expectedRevision: 3, examContent: {}, markingContent: {} }), /exam_not_editable/);

  const payment = await trusted.beginPaymentAttempt({ examId, teacherId: teacherA, phone: "254716000001", provider: "daraja", idempotencyKey: randomUUID() });
  const paymentId = String(payment.id);
  await withTrustedTransaction((client) => client.query("update public.payments set status = 'pending', verification_status = 'pending', external_request_id = $1, query_next_at = now() - interval '1 second' where id = $2::uuid", [`adapter-${paymentId}`, paymentId]).then(() => undefined));
  const leaseToken = randomUUID();
  assert.equal(await trusted.acquirePaymentQueryLease({ paymentId, leaseToken }), true);
  assert.equal(await trusted.completePaymentQueryLease({ paymentId, leaseToken }), true);
  assert.equal(await trusted.finalizeVerifiedPayment({ paymentId, examId, teacherId: teacherA, provider: "daraja", amount: Number(payment.amount), currency: "KES", providerReference: `adapter-${randomUUID()}`, providerReceipt: `A${randomUUID().replaceAll("-", "").slice(0, 20)}`, resultCode: "0" }), true);
  assert.equal(await trusted.finalizeVerifiedPayment({ paymentId, examId, teacherId: teacherA, provider: "daraja", amount: Number(payment.amount) + 1, currency: "KES", providerReference: "mismatched-reference" }), false);

  const visibleOwnExam = await withAuthenticatedTransaction(USER_A, (client) => queryRows<{ id: string }>(client, "select id from public.exams where id = $1::uuid", [examId]));
  const visibleOtherExam = await withAuthenticatedTransaction(USER_B, (client) => queryRows<{ id: string }>(client, "select id from public.exams where id = $1::uuid", [examId]));
  assert.equal(visibleOwnExam.length, 1, "Teacher A sees their own resource through RLS");
  assert.equal(visibleOtherExam.length, 0, "Teacher B cannot see Teacher A's resource through RLS");
  await assert.rejects(() => getPostgresPool().query("select * from public.list_ready_textbooks($1::uuid, $2::uuid)", [SUBJECT, GRADE]), /permission denied/);
  await assert.rejects(() => withAuthenticatedTransaction(USER_A, (client) => client.query("select public.fail_ai_operation($1::uuid, $2::uuid)", [teacherA, randomUUID()])), /permission denied/);
});
