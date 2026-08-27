import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PostgresCatalogRepository } from "../catalog/postgres.ts";
import { closePostgresPool, getPostgresPool, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresCatalogWriteRepository } from "./postgres.ts";

const ADMIN = "00000000-0000-4000-8000-000000000005";
const TEACHER = "00000000-0000-4000-8000-000000000006";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL catalog writes preserve CRUD, RLS, constraints, and read-after-write parity", async (context) => {
  const subjectId = randomUUID();
  const gradeId = randomUUID();
  const examId = randomUUID();
  const suffix = subjectId.slice(0, 8);
  const admin = new PostgresCatalogWriteRepository(ADMIN);
  const reads = new PostgresCatalogRepository(ADMIN);
  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        await client.query("delete from public.exams where id = $1::uuid", [examId]);
        await client.query("delete from public.subjects where name like $1", [`Write Subject ${suffix}%`]);
        await client.query("delete from public.grades where name like $1", [`Write Grade ${suffix}%`]);
      });
    } finally { await closePostgresPool(); }
  });

  await admin.createSubject(`Write Subject ${suffix}`);
  const subject = (await reads.listSubjectNames()).find((row) => row.name === `Write Subject ${suffix}`);
  assert.ok(subject);
  await admin.updateSubject(subject.id, `Write Subject ${suffix} Updated`);
  assert.equal((await reads.getSubjectById(subject.id))?.name, `Write Subject ${suffix} Updated`);
  await assert.rejects(() => admin.createSubject(`write subject ${suffix} updated`), /duplicate key/i);
  assert.equal(await admin.deleteSubject(randomUUID()), false);

  await admin.createGrade(`Write Grade ${suffix}`, "CBC");
  const grade = (await reads.listGradeNames()).find((row) => row.name === `Write Grade ${suffix}`);
  assert.ok(grade);
  await admin.updateGrade(grade.id, `Write Grade ${suffix} Updated`, "Secondary");
  assert.deepEqual(await reads.getGradeById(grade.id), { id: grade.id, name: `Write Grade ${suffix} Updated`, level: "Secondary" });
  await assert.rejects(() => admin.createGrade(`write grade ${suffix} updated`, "Other"), /duplicate key/i);
  assert.equal(await admin.deleteGrade(randomUUID()), false);

  await withTrustedTransaction((client) => client.query(
    `insert into public.exams (id, teacher_id, subject_id, grade_id, exam_type, marks, duration, difficulty, content, status, term, year)
     select $1::uuid, id, $2::uuid, $3::uuid, 'Write dependency', 10, 20, 'easy', '{}'::jsonb, 'draft', 'Term 1', 2026
       from public.teachers order by id limit 1`,
    [examId, subject.id, grade.id]
  ));
  await assert.rejects(() => admin.deleteSubject(subject.id), /foreign key constraint/i);
  await assert.rejects(() => admin.deleteGrade(grade.id), /foreign key constraint/i);
  await withTrustedTransaction((client) => client.query("delete from public.exams where id = $1::uuid", [examId]));

  assert.equal(await admin.deleteSubject(subject.id), true);
  assert.equal(await reads.getSubjectById(subject.id), null);
  assert.equal(await admin.deleteGrade(grade.id), true);
  assert.equal(await reads.getGradeById(grade.id), null);

  for (const userId of [TEACHER, UNKNOWN]) {
    const denied = new PostgresCatalogWriteRepository(userId);
    await assert.rejects(() => denied.createSubject(`Write Subject ${suffix} denied ${userId.slice(-2)}`), /row-level security|permission denied/i);
    await assert.rejects(() => denied.createGrade(`Write Grade ${suffix} denied ${userId.slice(-2)}`, "CBC"), /row-level security|permission denied/i);
    assert.equal(await denied.deleteSubject(subjectId), false);
    assert.equal(await denied.deleteGrade(gradeId), false);
  }
  await assert.rejects(() => getPostgresPool().query("insert into public.subjects (name) values ('raw unauthenticated write')"), /permission denied/i);
});
