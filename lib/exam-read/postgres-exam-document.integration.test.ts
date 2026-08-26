import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresTrustedRpcDatabase } from "../db/postgres-rpc.ts";
import { PostgresExamReadRepository } from "./postgres.ts";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const ADMIN = "00000000-0000-4000-8000-000000000005";
const NO_USER = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL document reads separate authorization metadata and ownership-scoped private content", async (context) => {
  const ids = { draftA: randomUUID(), generatedA: randomUUID(), paidA: randomUUID(), examB: randomUUID() };
  let teacherA = ""; let teacherB = "";
  await withTrustedTransaction(async (client) => {
    const teachers = await queryRows<{ id: string; user_id: string }>(client,
      "select id, user_id from public.teachers where user_id = any($1::uuid[]) order by user_id", [[USER_A, USER_B]]);
    assert.equal(teachers.length, 2); teacherA = teachers[0].id; teacherB = teachers[1].id;
    const base = (await queryRows<{ subject_id: string; grade_id: string }>(client,
      "select subject_id, grade_id from public.strands order by created_at limit 1", []))[0];
    assert.ok(base);
    await client.query(
      `insert into public.exams (id, teacher_id, subject_id, grade_id, exam_type, marks, duration, difficulty, content, status, term, year, revision, created_at)
       values ($1,$5,$6,$7,'A draft',20,30,'easy',$9::jsonb,'draft','Term 1',null,2,'2099-02-01T00:00:00Z'),
              ($2,$5,$6,$7,'A generated',30,40,'medium',$9::jsonb,'generated','Term 2',2026,3,'2099-02-02T00:00:00Z'),
              ($3,$5,$6,$7,'A paid',40,50,'hard',$9::jsonb,'generated','Term 3',2026,4,'2099-02-03T00:00:00Z'),
              ($4,$8,$6,$7,'B generated',50,60,'medium',$9::jsonb,'generated','Term 1',2025,5,'2099-02-04T00:00:00Z')`,
      [ids.draftA, ids.generatedA, ids.paidA, ids.examB, teacherA, base.subject_id, base.grade_id, teacherB, JSON.stringify({ syntheticDocument: true })]);
    await client.query("insert into public.marking_schemes (exam_id, content) values ($1,$5::jsonb),($2,$5::jsonb),($3,$5::jsonb),($4,$5::jsonb)",
      [ids.draftA, ids.generatedA, ids.paidA, ids.examB, JSON.stringify({ syntheticMarking: true })]);
  });
  const trusted = new PostgresTrustedRpcDatabase();
  const payment = await trusted.beginPaymentAttempt({ examId: ids.paidA, teacherId: teacherA, phone: "254716000009", provider: "daraja", idempotencyKey: randomUUID() });
  assert.equal(await trusted.finalizeVerifiedPayment({ paymentId: String(payment.id), examId: ids.paidA, teacherId: teacherA, provider: "daraja", amount: Number(payment.amount), currency: "KES", providerReference: `document-${randomUUID()}`, providerReceipt: `D${randomUUID().replaceAll("-", "").slice(0, 20)}`, resultCode: "0" }), true);
  context.after(async () => {
    try { await withTrustedTransaction(async (client) => {
      await client.query("delete from public.payments where exam_id = any($1::uuid[])", [Object.values(ids)]);
      await client.query("delete from public.exams where id = any($1::uuid[])", [Object.values(ids)]);
    }); }
    finally { await closePostgresPool(); }
  });

  const a = new PostgresExamReadRepository(USER_A, teacherA, "teacher");
  const b = new PostgresExamReadRepository(USER_B, teacherB, "teacher");
  const metadata = await a.getDocumentAccessMetadata(ids.generatedA);
  assert.deepEqual(metadata, { id: ids.generatedA, status: "generated", revision: 3 });
  assert.equal("content" in metadata!, false);
  assert.equal(await a.getDocumentAccessMetadata(ids.examB), null);
  assert.equal(await a.getDocumentAccessMetadata(randomUUID()), null);
  assert.equal((await a.getDocumentAccessMetadata(ids.paidA))?.status, "paid");

  const student = await a.getAuthorizedExamDocument(ids.draftA, false);
  assert.equal((student?.content as { syntheticDocument: boolean }).syntheticDocument, true);
  assert.deepEqual(student?.marking_schemes, []);
  const marking = await a.getAuthorizedExamDocument(ids.generatedA, true);
  assert.equal(marking?.marking_schemes.length, 1);
  assert.equal((marking?.marking_schemes[0].content as { syntheticMarking: boolean }).syntheticMarking, true);
  assert.equal(await a.getAuthorizedExamDocument(ids.examB, true), null);
  assert.equal(await b.getAuthorizedExamDocument(ids.generatedA, true), null);
  assert.equal((await b.getAuthorizedExamDocument(ids.examB, true))?.marking_schemes.length, 1);

  const unauthenticated = new PostgresExamReadRepository(NO_USER, null, null);
  assert.equal(await unauthenticated.getDocumentAccessMetadata(ids.draftA), null);
  assert.equal(await unauthenticated.getAuthorizedExamDocument(ids.draftA, true), null);

  const admin = new PostgresExamReadRepository(ADMIN, null, "admin");
  assert.equal((await admin.getDocumentAccessMetadata(ids.examB))?.id, ids.examB);
  assert.ok(await admin.getAuthorizedExamDocument(ids.examB, false));
  assert.deepEqual((await admin.getAuthorizedExamDocument(ids.examB, true))?.marking_schemes, []);
});
