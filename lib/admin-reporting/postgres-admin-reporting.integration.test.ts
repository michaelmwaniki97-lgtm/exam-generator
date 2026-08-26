import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, getPostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresAdminReportingRepository } from "./postgres.ts";

const ADMIN = "00000000-0000-4000-8000-000000000005";
const TEACHER = "00000000-0000-4000-8000-000000000006";
const UNAUTHENTICATED = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL admin reporting preserves counts, dependencies, metadata, and denial", async (context) => {
  const ids = Object.fromEntries([
    "grade", "subject", "strandA", "strandB", "sub", "otherSub", "book",
    "examSingle", "examRepeated", "examOther", "examIrrelevant", "examMalformed",
  ].map((key) => [key, randomUUID()]));
  let teacherA = "";
  let teacherB = "";
  await withTrustedTransaction(async (client) => {
    const teachers = await queryRows<{ id: string }>(client, "select id from public.teachers order by id limit 2", []);
    assert.equal(teachers.length, 2);
    teacherA = teachers[0].id;
    teacherB = teachers[1].id;
    await client.query("insert into public.grades(id,name,level,sort_order) values ($1,$2,'primary',97)", [ids.grade, `Admin Grade ${ids.grade.slice(0, 8)}`]);
    await client.query("insert into public.subjects(id,name) values ($1,$2)", [ids.subject, `Admin Subject ${ids.subject.slice(0, 8)}`]);
    await client.query(`insert into public.strands(id,grade_id,subject_id,name,sort_order,is_active)
      values ($1,$3,$4,'Active dependency',1,true),($2,$3,$4,'Inactive dependency',2,false)`, [ids.strandA, ids.strandB, ids.grade, ids.subject]);
    await client.query("insert into public.sub_strands(id,strand_id,name,sort_order) values ($1,$3,'Referenced topic',1),($2,$3,'Other topic',2)", [ids.sub, ids.otherSub, ids.strandA]);
    await client.query("insert into public.textbooks(id,subject_id,grade_id,name,publisher) values ($1,$2,$3,$4,null)", [ids.book, ids.subject, ids.grade, `Admin Book ${ids.book.slice(0, 8)}`]);
    await client.query(`insert into public.exams(id,teacher_id,subject_id,grade_id,exam_type,marks,duration,difficulty,content,status,term,year)
      values ($1,$6,$7,$8,'Single reference',20,30,'easy',$9::jsonb,'draft','Term 1',2026),
             ($2,$10,$7,$8,'Repeated reference',30,40,'medium',$11::jsonb,'generated','Term 2',null),
             ($3,$6,$7,$8,'Other topic',30,40,'medium',$12::jsonb,'generated','Term 2',2026),
             ($4,$6,$7,$8,'Irrelevant UUID',30,40,'medium',$13::jsonb,'generated','Term 2',2026),
             ($5,$6,$7,$8,'Malformed branch',30,40,'medium',$14::jsonb,'generated','Term 2',2026)`,
      [
        ids.examSingle, ids.examRepeated, ids.examOther, ids.examIrrelevant, ids.examMalformed,
        teacherA, ids.subject, ids.grade,
        JSON.stringify({ meta: { topicIds: [ids.sub] }, synthetic: true }), teacherB,
        JSON.stringify({ meta: { topicIds: [ids.sub, ids.sub] } }),
        JSON.stringify({ meta: { topicIds: [ids.otherSub] } }),
        JSON.stringify({ meta: { topicIds: [ids.otherSub], notes: ids.sub }, unrelated: [ids.sub] }),
        JSON.stringify({ meta: "not-an-object", topicIds: [ids.sub] }),
      ]);
  });
  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        await client.query("delete from public.exams where id = any($1::uuid[])", [[
          ids.examSingle, ids.examRepeated, ids.examOther, ids.examIrrelevant, ids.examMalformed,
        ]]);
        await client.query("delete from public.textbooks where id = $1", [ids.book]);
        await client.query("delete from public.grades where id = $1", [ids.grade]);
        await client.query("delete from public.subjects where id = $1", [ids.subject]);
      });
    } finally {
      await closePostgresPool();
    }
  });

  const admin = new PostgresAdminReportingRepository(ADMIN);
  assert.deepEqual(await admin.getSubjectDependencies(ids.subject), { curriculum: 2, textbooks: 1, exams: 5 });
  assert.deepEqual(await admin.getGradeDependencies(ids.grade), { curriculum: 2, textbooks: 1, exams: 5 });
  assert.deepEqual(await admin.getSubjectDependencies(randomUUID()), { curriculum: 0, textbooks: 0, exams: 0 });
  assert.equal(await admin.countExamsReferencingSubStrand(ids.sub), 2);
  assert.equal(await admin.countExamsReferencingSubStrand(ids.otherSub), 2);
  assert.equal(await admin.countExamsReferencingSubStrand(randomUUID()), 0);
  assert.ok((await admin.countDashboardExams()) >= 2);
  const book = (await admin.listTextbookMetadata()).find((row) => row.id === ids.book);
  assert.deepEqual(book, {
    id: ids.book,
    name: `Admin Book ${ids.book.slice(0, 8)}`,
    publisher: null,
    subject: { name: `Admin Subject ${ids.subject.slice(0, 8)}` },
    grade: { name: `Admin Grade ${ids.grade.slice(0, 8)}` },
  });

  for (const userId of [TEACHER, UNAUTHENTICATED]) {
    const denied = new PostgresAdminReportingRepository(userId);
    assert.equal(await denied.countDashboardExams(), 0);
    assert.deepEqual(await denied.getSubjectDependencies(ids.subject), { curriculum: 0, textbooks: 0, exams: 0 });
    assert.equal(await denied.countExamsReferencingSubStrand(ids.sub), 0);
    assert.deepEqual(await denied.listTextbookMetadata(), []);
  }
  await assert.rejects(() => getPostgresPool().query("select count(*) from public.exams"), /permission denied/);
});
