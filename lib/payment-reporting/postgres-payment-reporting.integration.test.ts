import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, getPostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresAdminPaymentReportingRepository, PostgresTeacherPaymentReportingRepository } from "./postgres.ts";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const ADMIN = "00000000-0000-4000-8000-000000000005";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL reporting preserves isolation, status history, revenue, and role denial", async (context) => {
  const ids = Object.fromEntries(["grade", "subject", "aInitiated", "aPending", "aPaid", "aFailed", "aCancelled", "aExpired", "bPaid"]
    .map((key) => [key, randomUUID()]));
  let teacherA = "";
  let teacherB = "";
  let adminTeacher = "";
  let baselineRevenue = 0;
  const paymentIds: string[] = [];
  await withTrustedTransaction(async (client) => {
    const teachers = await queryRows<{ id: string; user_id: string }>(client,
      "select id, user_id from public.teachers where user_id = any($1::uuid[]) order by user_id", [[USER_A, USER_B, ADMIN]]);
    teacherA = teachers.find((row) => row.user_id === USER_A)?.id ?? "";
    teacherB = teachers.find((row) => row.user_id === USER_B)?.id ?? "";
    adminTeacher = teachers.find((row) => row.user_id === ADMIN)?.id ?? "";
    assert.ok(teacherA && teacherB && adminTeacher);
    baselineRevenue = Number((await queryRows<{ total: string }>(client,
      "select coalesce(sum(amount), 0)::text as total from public.payments where status = 'paid'", []))[0].total);
    await client.query("insert into public.grades(id,name,level,sort_order) values ($1,$2,'primary',98)", [ids.grade, `Payment Grade ${ids.grade.slice(0, 8)}`]);
    await client.query("insert into public.subjects(id,name) values ($1,$2)", [ids.subject, `Payment Subject ${ids.subject.slice(0, 8)}`]);
    const examIds = [ids.aInitiated, ids.aPending, ids.aPaid, ids.aFailed, ids.aCancelled, ids.aExpired, ids.bPaid];
    for (let index = 0; index < examIds.length; index += 1) {
      await client.query(`insert into public.exams(id,teacher_id,subject_id,grade_id,exam_type,marks,duration,difficulty,content,status,term,year,created_at)
        values ($1,$2,$3,$4,$5,20,30,'easy','{"sections":[]}'::jsonb,'generated','Term 1',2026,$6::timestamptz)`,
      [examIds[index], index === examIds.length - 1 ? teacherB : teacherA, ids.subject, ids.grade, `Payment fixture ${index}`, `2026-03-0${index + 1}T00:00:00Z`]);
    }
    const statuses = ["initiated", "pending", "paid", "failed", "cancelled", "expired", "paid"];
    const amounts = [100, 110, 300, 120, 130, 140, 700];
    for (let index = 0; index < examIds.length; index += 1) {
      const inserted = await queryRows<{ id: string }>(client, `insert into public.payments(exam_id,teacher_id,amount,provider,currency,status,verification_status,mpesa_ref,completed_at,created_at)
        values ($1,$2,$3,'phase10a','KES',$4,$5,$6,$7::timestamptz,$8::timestamptz) returning id`, [
        examIds[index], index === examIds.length - 1 ? teacherB : teacherA, amounts[index], statuses[index],
        statuses[index] === "paid" ? "verified" : "unverified",
        statuses[index] === "paid" ? `RCP${index}${ids.grade.slice(0, 8)}` : null,
        statuses[index] === "paid" ? `2026-04-0${index + 1}T00:00:00Z` : null,
        `2026-03-0${index + 1}T00:00:00Z`,
      ]);
      paymentIds.push(inserted[0].id);
    }
  });
  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        await client.query("delete from public.payments where id = any($1::uuid[])", [paymentIds]);
        await client.query("delete from public.exams where id = any($1::uuid[])", [[ids.aInitiated, ids.aPending, ids.aPaid, ids.aFailed, ids.aCancelled, ids.aExpired, ids.bPaid]]);
        await client.query("delete from public.grades where id = $1", [ids.grade]);
        await client.query("delete from public.subjects where id = $1", [ids.subject]);
      });
    } finally { await closePostgresPool(); }
  });

  const historyA = await new PostgresTeacherPaymentReportingRepository(USER_A, teacherA).listTeacherPaymentHistory();
  const fixturesA = historyA.filter((row) => paymentIds.slice(0, 6).includes(row.id));
  assert.deepEqual(fixturesA.map((row) => row.status), ["expired", "cancelled", "failed", "paid", "pending", "initiated"]);
  assert.deepEqual(fixturesA.map((row) => row.amount), [140, 130, 120, 300, 110, 100]);
  assert.ok(fixturesA.every((row) => row.currency === "KES" && Object.keys(row).sort().join(",") === "amount,completed_at,created_at,currency,exams,id,receiptReference,status"));
  assert.equal(fixturesA.find((row) => row.status === "paid")?.receiptReference?.startsWith("RCP"), true);
  assert.equal(fixturesA.find((row) => row.status === "pending")?.completed_at, null);
  assert.ok(fixturesA.every((row) => row.exams?.exam_type.startsWith("Payment fixture")));

  const historyB = await new PostgresTeacherPaymentReportingRepository(USER_B, teacherB).listTeacherPaymentHistory();
  assert.ok(historyB.some((row) => row.id === paymentIds[6]));
  assert.ok(!historyB.some((row) => row.id === paymentIds[2]));
  assert.ok(!historyA.some((row) => row.id === paymentIds[6]));

  await assert.rejects(() => new PostgresTeacherPaymentReportingRepository(UNKNOWN, teacherA).listTeacherPaymentHistory(), /Teacher access is required/);
  await assert.rejects(() => new PostgresTeacherPaymentReportingRepository(ADMIN, adminTeacher).listTeacherPaymentHistory(), /Teacher access is required/);
  assert.equal(await new PostgresAdminPaymentReportingRepository(ADMIN).getAdminPaidRevenue(), baselineRevenue + 1_000);
  assert.equal(await new PostgresAdminPaymentReportingRepository(USER_A).getAdminPaidRevenue(), 0);
  assert.equal(await new PostgresAdminPaymentReportingRepository(UNKNOWN).getAdminPaidRevenue(), 0);
  await assert.rejects(() => getPostgresPool().query("select id from public.payments"), /permission denied/);
});
