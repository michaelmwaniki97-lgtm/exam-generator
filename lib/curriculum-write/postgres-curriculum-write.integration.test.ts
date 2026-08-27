import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PostgresCurriculumReadRepository } from "../curriculum-read/postgres.ts";
import { closePostgresPool, getPostgresPool, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresCurriculumWriteRepository } from "./postgres.ts";

const ADMIN = "00000000-0000-4000-8000-000000000005";
const TEACHER = "00000000-0000-4000-8000-000000000006";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL curriculum writes preserve hierarchy CRUD, RLS, constraints, and read parity", async (context) => {
  const subjectId = randomUUID();
  const otherSubjectId = randomUUID();
  const gradeId = randomUUID();
  const formGradeId = randomUUID();
  const prefix = `Write curriculum ${subjectId.slice(0, 8)}`;
  const admin = new PostgresCurriculumWriteRepository(ADMIN);
  const reads = new PostgresCurriculumReadRepository(ADMIN);

  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        await client.query("delete from public.learning_outcomes where description like $1::text", [`${prefix}%`]);
        await client.query("delete from public.sub_strands where name like $1::text", [`${prefix}%`]);
        await client.query("delete from public.strands where name like $1::text", [`${prefix}%`]);
        await client.query("delete from public.subjects where id = any($1::uuid[])", [[subjectId, otherSubjectId]]);
        await client.query("delete from public.grades where id = any($1::uuid[])", [[gradeId, formGradeId]]);
      });
    } finally { await closePostgresPool(); }
  });

  await withTrustedTransaction(async (client) => {
    await client.query("insert into public.subjects (id, name) values ($1::uuid, $2::text), ($3::uuid, $4::text)",
      [subjectId, `${prefix} subject`, otherSubjectId, `${prefix} other subject`]);
    await client.query("insert into public.grades (id, name, level) values ($1::uuid, $2::text, 'CBC'), ($3::uuid, $4::text, 'Secondary')",
      [gradeId, `${prefix} grade`, formGradeId, `${prefix} form`]);
  });

  await admin.createStrand(gradeId, subjectId, `${prefix} strand`);
  const strand = (await reads.listStrandNames(gradeId, subjectId)).find((row) => row.name === `${prefix} strand`);
  assert.ok(strand);
  assert.equal((await reads.listStrandNames(gradeId, otherSubjectId)).length, 0);
  await assert.rejects(() => admin.createStrand(gradeId, subjectId, `${prefix.toLowerCase()} strand`), /duplicate key/i);
  await assert.rejects(() => admin.createStrand(randomUUID(), subjectId, `${prefix} invalid parent`), /foreign key/i);

  await withTrustedTransaction((client) => client.query(
    `update public.strands set sort_order = 17, source_code = 'legacy', source_ref = 'fixture',
       verification_status = 'verified_official', outcome_status = 'sourced', source_metadata = '{"fixture":true}'::jsonb
     where id = $1::uuid`, [strand.id]));
  await admin.updateStrand(strand.id, `${prefix} strand updated`);
  const strandState = await withTrustedTransaction(async (client) => (await client.query<{
    name: string; sort_order: number; source_code: string | null; source_ref: string | null;
    verification_status: string; outcome_status: string; source_metadata: Record<string, unknown>;
  }>(`select name, sort_order, source_code, source_ref, verification_status, outcome_status, source_metadata
        from public.strands where id = $1::uuid`, [strand.id])).rows[0]);
  assert.deepEqual(strandState, {
    name: `${prefix} strand updated`, sort_order: 17, source_code: null, source_ref: null,
    verification_status: "unverified", outcome_status: "unverified", source_metadata: {},
  });

  await admin.createSubStrand(strand.id, `${prefix} sub`);
  const sub = (await reads.listSubStrandNames(strand.id)).find((row) => row.name === `${prefix} sub`);
  assert.ok(sub);
  await assert.rejects(() => admin.createSubStrand(strand.id, `${prefix.toUpperCase()} SUB`), /duplicate key/i);
  await assert.rejects(() => admin.createSubStrand(randomUUID(), `${prefix} invalid sub parent`), /foreign key/i);
  await withTrustedTransaction((client) => client.query(
    `update public.sub_strands set sort_order = 9, source_code = 'legacy', source_ref = 'fixture',
       verification_status = 'verified_official', outcome_status = 'sourced', source_metadata = '{"fixture":true}'::jsonb
     where id = $1::uuid`, [sub.id]));
  await admin.updateSubStrand(sub.id, `${prefix} sub updated`);

  await admin.createLearningOutcome(sub.id, `${prefix} outcome`);
  const outcome = (await reads.listLearningOutcomeDescriptions(sub.id)).find((row) => row.description === `${prefix} outcome`);
  assert.ok(outcome);
  await assert.rejects(() => admin.createLearningOutcome(sub.id, `${prefix.toUpperCase()} OUTCOME`), /duplicate key/i);
  await assert.rejects(() => admin.createLearningOutcome(randomUUID(), `${prefix} invalid outcome parent`), /foreign key/i);
  await withTrustedTransaction((client) => client.query(
    `update public.learning_outcomes set sort_order = 4, source_ref = 'fixture',
       verification_status = 'verified_official', source_metadata = '{"fixture":true}'::jsonb
     where id = $1::uuid`, [outcome.id]));
  await admin.updateLearningOutcome(outcome.id, `${prefix} outcome updated`);

  const hierarchy = await reads.listAdminHierarchy(gradeId, subjectId);
  const readStrand = hierarchy.find((row) => row.id === strand.id);
  const readSub = readStrand?.sub_strands.find((row) => row.id === sub.id);
  const readOutcome = readSub?.learning_outcomes.find((row) => row.id === outcome.id);
  assert.equal(readStrand?.sort_order, 17);
  assert.equal(readSub?.name, `${prefix} sub updated`);
  assert.equal(readSub?.sort_order, 9);
  assert.equal(readSub?.verification_status, "unverified");
  assert.equal(readOutcome?.description, `${prefix} outcome updated`);
  assert.equal(readOutcome?.sort_order, 4);
  assert.equal(readOutcome?.verification_status, "unverified");

  // Form topics/sub-topics remain valid without fabricated learning outcomes.
  await admin.createStrand(formGradeId, subjectId, `${prefix} form topic`);
  const formStrand = (await reads.listStrandNames(formGradeId, subjectId)).find((row) => row.name === `${prefix} form topic`);
  assert.ok(formStrand);
  await admin.createSubStrand(formStrand.id, `${prefix} form sub-topic`);
  const formSub = (await reads.listSubStrandNames(formStrand.id)).find((row) => row.name === `${prefix} form sub-topic`);
  assert.ok(formSub);
  assert.equal(await reads.countLearningOutcomes(formSub.id), 0);

  // Repository deletion retains historical DB cascade semantics; actions perform pre-checks first.
  assert.equal(await admin.deleteLearningOutcome(outcome.id), true);
  assert.equal((await reads.listLearningOutcomeDescriptions(sub.id)).some((row) => row.id === outcome.id), false);
  assert.equal(await admin.deleteLearningOutcome(randomUUID()), false);
  assert.equal(await admin.deleteSubStrand(sub.id), true);
  assert.equal((await reads.listSubStrandNames(strand.id)).some((row) => row.id === sub.id), false);
  assert.equal(await admin.deleteSubStrand(randomUUID()), false);
  assert.equal(await admin.deleteStrand(strand.id), true);
  assert.equal((await reads.listStrandNames(gradeId, subjectId)).some((row) => row.id === strand.id), false);
  assert.equal(await admin.deleteStrand(randomUUID()), false);

  assert.equal(await admin.deleteStrand(formStrand.id), true); // cascades its child exactly as the schema historically does
  assert.equal(await reads.getSubStrandParent(formSub.id), null);

  for (const userId of [TEACHER, UNKNOWN]) {
    const denied = new PostgresCurriculumWriteRepository(userId);
    await assert.rejects(() => denied.createStrand(gradeId, subjectId, `${prefix} denied ${userId.slice(-2)}`), /row-level security|permission denied/i);
    await assert.rejects(() => denied.createSubStrand(randomUUID(), `${prefix} denied sub`), /row-level security|permission denied/i);
    await assert.rejects(() => denied.createLearningOutcome(randomUUID(), `${prefix} denied outcome`), /row-level security|permission denied/i);
    assert.equal(await denied.deleteStrand(randomUUID()), false);
    assert.equal(await denied.deleteSubStrand(randomUUID()), false);
    assert.equal(await denied.deleteLearningOutcome(randomUUID()), false);
  }
  await assert.rejects(
    () => getPostgresPool().query("insert into public.strands (grade_id, subject_id, name) values ($1, $2, $3)", [gradeId, subjectId, `${prefix} raw`]),
    /permission denied/i
  );
});
