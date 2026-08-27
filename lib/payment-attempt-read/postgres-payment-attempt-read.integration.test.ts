import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresPaymentAttemptReadRepository } from "./postgres.ts";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";

test("direct PostgreSQL attempt reads preserve correlation, normalization, latest selection, and isolation", async (context) => {
  const ids = Object.fromEntries(["grade", "subject", "examA", "examA2", "examB", "failed", "paid", "pending", "laterFailed", "otherExam", "b", "card", "tiedPaid"].map((key) => [key, randomUUID()]));
  let teacherA = ""; let teacherB = "";
  const paymentIds = [ids.failed, ids.paid, ids.pending, ids.laterFailed, ids.otherExam, ids.b, ids.card, ids.tiedPaid];
  await withTrustedTransaction(async (client) => {
    const teachers = await queryRows<{ id: string; user_id: string }>(client, "select id,user_id from public.teachers where user_id=any($1::uuid[])", [[USER_A, USER_B]]);
    teacherA = teachers.find((row) => row.user_id === USER_A)?.id ?? ""; teacherB = teachers.find((row) => row.user_id === USER_B)?.id ?? "";
    assert.ok(teacherA && teacherB);
    await client.query("insert into public.grades(id,name,level,sort_order) values($1,$2,'primary',97)", [ids.grade, `Attempt Grade ${ids.grade.slice(0, 8)}`]);
    await client.query("insert into public.subjects(id,name) values($1,$2)", [ids.subject, `Attempt Subject ${ids.subject.slice(0, 8)}`]);
    for (const [examId, owner, label] of [[ids.examA, teacherA, "A"], [ids.examA2, teacherA, "A2"], [ids.examB, teacherB, "B"]]) {
      await client.query(`insert into public.exams(id,teacher_id,subject_id,grade_id,exam_type,marks,duration,difficulty,content,status,term,year)
        values($1,$2,$3,$4,$5,20,30,'easy','{"sections":[]}'::jsonb,'generated','Term 1',2026)`, [examId, owner, ids.subject, ids.grade, `Attempt ${label}`]);
    }
    const rows = [
      [ids.failed, ids.examA, teacherA, "daraja", "failed", "rejected", "checkout-failed", "merchant-failed", null, "2026-05-01T00:00:00Z", null],
      [ids.paid, ids.examA, teacherA, "daraja", "paid", "verified", "checkout-paid", "merchant-paid", "provider-paid", "2026-05-02T00:00:00Z", "2026-05-02T00:05:00Z"],
      [ids.pending, ids.examA, teacherA, "daraja", "pending", "pending", "checkout-pending", "merchant-pending", null, "2026-05-03T00:00:00Z", null],
      [ids.laterFailed, ids.examA, teacherA, "daraja", "failed", "rejected", "checkout-later-failed", "merchant-later-failed", null, "2026-05-04T00:00:00Z", null],
      [ids.otherExam, ids.examA2, teacherA, "daraja", "pending", "pending", "checkout-other", "merchant-other", null, "2026-05-05T00:00:00Z", null],
      [ids.b, ids.examB, teacherB, "daraja", "paid", "verified", "checkout-b", "merchant-b", "provider-b", "2026-05-06T00:00:00Z", "2026-05-06T00:05:00Z"],
      [ids.card, ids.examA2, teacherA, "cardfixture", "paid", "verified", "card-session", null, "card-transaction", "2026-05-07T00:00:00Z", "2026-05-07T00:05:00Z"],
      [ids.tiedPaid, ids.examA, teacherA, "cardfixture", "paid", "verified", "card-tied", null, "card-tied-ref", "2026-05-03T00:00:00Z", "2026-05-03T00:05:00Z"],
    ];
    for (const row of rows) await client.query(`insert into public.payments(id,exam_id,teacher_id,amount,currency,phone,provider,status,verification_status,external_request_id,provider_request_id,provider_reference,created_at,completed_at)
      values($1,$2,$3,100,'KES','254712345678',$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz)`, row);
    await client.query("update public.payments set query_next_at=now()+interval '30 seconds',query_lease_token=$2,query_lease_until=now()+interval '20 seconds',query_attempt_count=2 where id=$1", [ids.pending, randomUUID()]);
  });
  context.after(async () => {
    try { await withTrustedTransaction(async (client) => {
      await client.query("delete from public.payments where id=any($1::uuid[])", [paymentIds]);
      await client.query("delete from public.exams where id=any($1::uuid[])", [[ids.examA, ids.examA2, ids.examB]]);
      await client.query("delete from public.grades where id=$1", [ids.grade]); await client.query("delete from public.subjects where id=$1", [ids.subject]);
    }); } finally { await closePostgresPool(); }
  });

  const repository = new PostgresPaymentAttemptReadRepository();
  const pending = await repository.getAttempt(ids.pending);
  assert.deepEqual(Object.keys(pending ?? {}).sort(), ["amount","completedAt","createdAt","currency","examId","externalRequestId","id","phone","provider","providerReference","providerRequestId","status","teacherId"].sort());
  assert.equal(pending?.status, "pending"); assert.equal(pending?.currency, "KES"); assert.equal(pending?.providerRequestId, "merchant-pending");
  assert.equal(await repository.getAttempt(randomUUID()), null); assert.equal(await repository.getAttempt("malformed"), null);
  assert.equal((await repository.getAttemptByExternalRequest("daraja", "checkout-paid"))?.id, ids.paid);
  assert.equal(await repository.getAttemptByExternalRequest("cardfixture", "checkout-paid"), null);
  assert.equal((await repository.getAttemptByExternalRequest("cardfixture", "card-session"))?.id, ids.card);
  assert.equal(await repository.getAttemptByExternalRequest("daraja", "unknown"), null);
  const latestA = await repository.getLatestAttemptForExam(teacherA, ids.examA);
  assert.ok([ids.pending, ids.tiedPaid].includes(latestA?.id ?? ""), "equal newest timestamps remain historically unspecified");
  assert.notEqual(latestA?.id, ids.laterFailed); assert.equal(await repository.getLatestAttemptForExam(teacherB, ids.examA), null);
  assert.equal((await repository.getLatestAttemptForExam(teacherA, ids.examA2))?.id, ids.card);
  assert.equal(await repository.getLatestAttemptForExam(teacherA, ids.examB), null);
  await assert.rejects(() => withTrustedTransaction((client) => client.query(`insert into public.payments(exam_id,teacher_id,amount,currency,provider,status,verification_status,external_request_id)
    values($1,$2,100,'KES','daraja','failed','rejected','checkout-paid')`, [ids.examA2, teacherA])), /duplicate key/);
});
