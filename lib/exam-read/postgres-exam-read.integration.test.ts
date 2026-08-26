import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresExamReadRepository } from "./postgres.ts";

const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const NO_USER = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL exam reads preserve ownership, projections, states, revision, and marking authorization", async (context) => {
  const ids = { a1: randomUUID(), a2: randomUUID(), a3: randomUUID(), b1: randomUUID() };
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
       values ($1,$5,$6,$7,'A oldest',20,30,'easy',$9::jsonb,'draft','Term 1',null,2,'2099-01-01T00:00:00Z'),
              ($2,$5,$6,$7,'A generated',40,60,'medium',$9::jsonb,'generated','Term 2',2026,3,'2099-01-02T00:00:00Z'),
              ($3,$5,$6,$7,'A paid',60,90,'hard',$9::jsonb,'paid','Term 3',2026,4,'2099-01-03T00:00:00Z'),
              ($4,$8,$6,$7,'B downloaded',80,120,'medium',$9::jsonb,'downloaded','Term 1',2025,5,'2099-01-04T00:00:00Z')`,
      [ids.a1, ids.a2, ids.a3, ids.b1, teacherA, base.subject_id, base.grade_id, teacherB, JSON.stringify({ synthetic: true })]);
    await client.query("insert into public.marking_schemes (exam_id, content) values ($1,$4::jsonb),($2,$4::jsonb),($3,$4::jsonb)",
      [ids.a1, ids.a2, ids.b1, JSON.stringify({ syntheticMarking: true })]);
  });
  context.after(async () => {
    try { await withTrustedTransaction(async (client) => { await client.query("delete from public.exams where id = any($1::uuid[])", [Object.values(ids)]); }); }
    finally { await closePostgresPool(); }
  });

  const a = new PostgresExamReadRepository(USER_A, teacherA);
  const b = new PostgresExamReadRepository(USER_B, teacherB);
  const aList = await a.listTeacherExams();
  const syntheticA = aList.filter((row) => [ids.a1, ids.a2, ids.a3].includes(row.id));
  assert.deepEqual(syntheticA.map((row) => row.id), [ids.a3, ids.a2, ids.a1]);
  assert.equal(aList.some((row) => row.id === ids.b1), false);
  assert.ok(aList.every((row) => !("content" in row) && !("marking_schemes" in row)));
  assert.deepEqual(syntheticA.map((row) => row.status), ["paid", "generated", "draft"]);
  assert.equal(syntheticA[2].term, "Term 1"); assert.equal(syntheticA[2].year, null);
  assert.deepEqual((await a.listRecentTeacherExams(2)).map((row) => row.id), [ids.a3, ids.a2]);
  const bList = await b.listTeacherExams();
  assert.ok(bList.some((row) => row.id === ids.b1));
  assert.equal(bList.some((row) => [ids.a1, ids.a2, ids.a3].includes(row.id)), false);

  const own = await a.getTeacherExamForEditing(ids.a2);
  assert.equal(own?.teacher_id, teacherA); assert.equal(own?.revision, 3); assert.equal(own?.marking_schemes.length, 1);
  assert.equal(await a.getTeacherExamForEditing(ids.b1), null);
  assert.equal(await b.getTeacherExamForEditing(ids.a2), null);
  assert.equal((await b.getTeacherExamForEditing(ids.b1))?.marking_schemes.length, 1);
  assert.equal(await a.getTeacherExamForEditing(randomUUID()), null);
  const unauthenticated = new PostgresExamReadRepository(NO_USER, teacherA);
  assert.deepEqual(await unauthenticated.listTeacherExams(), []);
  assert.equal(await unauthenticated.getTeacherExamForEditing(ids.a1), null);
  await assert.rejects(() => a.getTeacherExamForEditing("not-a-uuid"), /uuid|syntax/i);
});
