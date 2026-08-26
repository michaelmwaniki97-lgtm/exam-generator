import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, getPostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresPaymentEntitlementReadRepository } from "./postgres.ts";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const ADMIN = "00000000-0000-4000-8000-000000000005";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL entitlement preserves canonical paid existence, ownership, and provider neutrality", async (context) => {
  const ids = Object.fromEntries(["grade", "subject", "aPaid", "aUnpaid", "aCard", "aOther", "bPaid"].map((key) => [key, randomUUID()]));
  const paymentIds: string[] = [];
  let teacherA = ""; let teacherB = ""; let adminTeacher = "";
  await withTrustedTransaction(async (client) => {
    const teachers = await queryRows<{ id: string; user_id: string }>(client,
      "select id, user_id from public.teachers where user_id = any($1::uuid[]) order by user_id", [[USER_A, USER_B, ADMIN]]);
    teacherA = teachers.find((row) => row.user_id === USER_A)?.id ?? "";
    teacherB = teachers.find((row) => row.user_id === USER_B)?.id ?? "";
    adminTeacher = teachers.find((row) => row.user_id === ADMIN)?.id ?? "";
    assert.ok(teacherA && teacherB && adminTeacher);
    await client.query("insert into public.grades(id,name,level,sort_order) values ($1,$2,'primary',99)", [ids.grade, `Entitlement Grade ${ids.grade.slice(0, 8)}`]);
    await client.query("insert into public.subjects(id,name) values ($1,$2)", [ids.subject, `Entitlement Subject ${ids.subject.slice(0, 8)}`]);
    for (const [examId, owner, label] of [[ids.aPaid, teacherA, "A paid"], [ids.aUnpaid, teacherA, "A unpaid"], [ids.aCard, teacherA, "A card"], [ids.aOther, teacherA, "A other"], [ids.bPaid, teacherB, "B paid"]]) {
      await client.query(`insert into public.exams(id,teacher_id,subject_id,grade_id,exam_type,marks,duration,difficulty,content,status,term,year)
        values ($1,$2,$3,$4,$5,20,30,'easy','{"sections":[]}'::jsonb,'generated','Term 1',2026)`, [examId, owner, ids.subject, ids.grade, label]);
    }
    const fixtures: Array<[string, string, number, string, string, string, string | null, string | null, string | null, string | null]> = [
      [ids.aPaid, teacherA, 100, "daraja", "paid", "verified", "daraja-paid", null, null, null],
      [ids.aPaid, teacherA, 100, "otherpay", "paid", "verified", "other-paid", null, null, null],
      [ids.aUnpaid, teacherA, 100, "daraja", "pending", "pending", "pending-reference", "checkout-present", "merchant-present", "RECEIPT01"],
      [ids.aUnpaid, teacherA, 100, "daraja", "failed", "rejected", "failed-reference", "checkout-failed", "merchant-failed", "RECEIPT02"],
      [ids.aCard, teacherA, 100, "cardfixture", "paid", "verified", "card-transaction", "card-request", "card-provider-request", null],
      [ids.aOther, teacherA, 100, "daraja", "failed", "rejected", null, null, null, null],
      [ids.bPaid, teacherB, 100, "daraja", "paid", "verified", "teacher-b-paid", null, null, null],
    ];
    for (const [examId, teacherId, amount, provider, status, verification, reference, external, providerRequest, receipt] of fixtures) {
      const inserted = await queryRows<{ id: string }>(client, `insert into public.payments
        (exam_id,teacher_id,amount,provider,currency,status,verification_status,provider_reference,external_request_id,provider_request_id,mpesa_ref)
        values ($1,$2,$3,$4,'KES',$5,$6,$7,$8,$9,$10) returning id`,
      [examId, teacherId, amount, provider, status, verification, reference, external, providerRequest, receipt]);
      paymentIds.push(inserted[0].id);
    }
  });
  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        await client.query("delete from public.payments where id = any($1::uuid[])", [paymentIds]);
        await client.query("delete from public.exams where id = any($1::uuid[])", [[ids.aPaid, ids.aUnpaid, ids.aCard, ids.aOther, ids.bPaid]]);
        await client.query("delete from public.grades where id = $1", [ids.grade]);
        await client.query("delete from public.subjects where id = $1", [ids.subject]);
      });
    } finally { await closePostgresPool(); }
  });

  const a = new PostgresPaymentEntitlementReadRepository(USER_A, teacherA);
  const b = new PostgresPaymentEntitlementReadRepository(USER_B, teacherB);
  assert.equal(await a.hasSuccessfulPaymentForExam(ids.aPaid), true);
  assert.equal(await a.hasSuccessfulPaymentForExam(ids.aCard), true);
  assert.equal(await a.hasSuccessfulPaymentForExam(ids.aUnpaid), false);
  assert.equal(await a.hasSuccessfulPaymentForExam(ids.aOther), false);
  assert.equal(await a.hasSuccessfulPaymentForExam(ids.bPaid), false);
  assert.equal(await b.hasSuccessfulPaymentForExam(ids.bPaid), true);
  assert.equal(await b.hasSuccessfulPaymentForExam(ids.aPaid), false);
  assert.equal(await new PostgresPaymentEntitlementReadRepository(USER_A, teacherB).hasSuccessfulPaymentForExam(ids.bPaid), false);
  assert.equal(await new PostgresPaymentEntitlementReadRepository(UNKNOWN, teacherA).hasSuccessfulPaymentForExam(ids.aPaid), false);
  assert.equal(await new PostgresPaymentEntitlementReadRepository(ADMIN, adminTeacher).hasSuccessfulPaymentForExam(ids.aPaid), false);
  assert.equal(await a.hasSuccessfulPaymentForExam(randomUUID()), false);
  assert.equal(await a.hasSuccessfulPaymentForExam("malformed"), false);
  await assert.rejects(() => getPostgresPool().query("select id from public.payments"), /permission denied/);
});
