import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, getPostgresPool, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresCurriculumReadRepository } from "./postgres.ts";

const USER = "00000000-0000-4000-8000-000000000006";

test("direct PostgreSQL curriculum preserves scoped CBC and Form hierarchy contracts", async (context) => {
  context.after(closePostgresPool);
  const ids = Object.fromEntries(["g1", "g2", "su1", "su2", "cbc", "inactive", "form", "cbcSub1", "cbcSub2", "inactiveSub", "formSub", "lo1", "lo2", "obj1", "obj2"].map((key) => [key, randomUUID()]));
  const suffix = ids.g1.slice(0, 8);
  await withTrustedTransaction(async (client) => {
    await client.query("insert into public.grades(id,name,level,sort_order) values ($1,$3,'primary',91),($2,$4,'secondary',92)", [ids.g1, ids.g2, `Parity CBC Grade ${suffix}`, `Parity Form Grade ${suffix}`]);
    await client.query("insert into public.subjects(id,name) values ($1,$3),($2,$4)", [ids.su1, ids.su2, `Parity Science ${suffix}`, `Parity History ${suffix}`]);
    await client.query(`insert into public.strands(id,grade_id,subject_id,name,sort_order,is_active,verification_status,outcome_status,source_code,source_ref)
      values ($1,$2,$3,'CBC active',20,true,'verified_official','sourced','CBC-20',null),
             ($4,$2,$3,'CBC inactive',10,false,'unverified','unverified',null,null),
             ($5,$6,$7,'Form topic',5,true,'verified_official','sourced','FORM-5','form-source')`,
      [ids.cbc, ids.g1, ids.su1, ids.inactive, ids.form, ids.g2, ids.su2]);
    await client.query(`insert into public.sub_strands(id,strand_id,name,sort_order,verification_status,source_code,source_ref)
      values ($1,$2,'CBC later',9,'unverified',null,null),($3,$2,'CBC earlier',2,'verified_official','CBC-2','cbc-source'),
             ($4,$5,'Inactive child',1,'unverified',null,null),($6,$7,'Form subtopic',1,'verified_official','FORM-5-1',null)`,
      [ids.cbcSub1, ids.cbc, ids.cbcSub2, ids.inactiveSub, ids.inactive, ids.formSub, ids.form]);
    await client.query(`insert into public.learning_outcomes(id,sub_strand_id,description,sort_order,verification_status)
      values ($1,$2,'CBC outcome later',8,'unverified'),($3,$2,'CBC outcome earlier',1,'verified_official')`,
      [ids.lo1, ids.cbcSub2, ids.lo2]);
    await client.query(`insert into public.strand_objectives(id,strand_id,description,label,sort_order,verification_status)
      values ($1,$2,'Form objective later','Objective B',7,'verified_official'),($3,$2,'Form objective earlier',null,1,'unverified')`,
      [ids.obj1, ids.form, ids.obj2]);
  });

  const repository = new PostgresCurriculumReadRepository(USER);
  const gradeIds = await repository.listActiveGradeIds();
  assert.ok(gradeIds.includes(ids.g1) && gradeIds.includes(ids.g2));
  const contexts = await repository.listSubjectContextsForGrade(ids.g1);
  assert.ok(contexts.every((row) => row.grade_id === ids.g1 && row.is_active));
  assert.ok(contexts.some((row) => row.subject?.id === ids.su1));

  const cbc = await repository.listActiveHierarchy(ids.g1, ids.su1);
  assert.equal(cbc.length, 1);
  assert.equal(cbc[0].id, ids.cbc);
  assert.deepEqual(cbc[0].sub_strands.map((row) => row.id), [ids.cbcSub2, ids.cbcSub1]);
  assert.equal(cbc[0].source_ref, null);
  assert.deepEqual(await repository.listActiveHierarchy(ids.g1, ids.su2), []);
  assert.deepEqual(await repository.listActiveHierarchy(randomUUID(), ids.su1), []);

  const selections = await repository.getSelectionTopics([ids.cbcSub2, ids.formSub, ids.inactiveSub]);
  const cbcSelection = selections.find((row) => row.id === ids.cbcSub2)!;
  const formSelection = selections.find((row) => row.id === ids.formSub)!;
  const inactiveSelection = selections.find((row) => row.id === ids.inactiveSub)!;
  assert.deepEqual(cbcSelection.learning_outcomes.map((row) => row.description), ["CBC outcome earlier", "CBC outcome later"]);
  assert.deepEqual(cbcSelection.strands?.strand_objectives, []);
  assert.deepEqual(formSelection.learning_outcomes, []);
  assert.deepEqual(formSelection.strands?.strand_objectives.map((row) => row.description), ["Form objective earlier", "Form objective later"]);
  assert.equal(inactiveSelection.strands?.is_active, false);
  assert.deepEqual(await repository.getSelectionTopics([randomUUID()]), []);
  assert.deepEqual(await repository.getSelectionTopics([]), []);

  const adminForm = await repository.listAdminHierarchy(ids.g2, ids.su2);
  assert.equal(adminForm.length, 1);
  assert.deepEqual(adminForm[0].strand_objectives.map((row) => row.id), [ids.obj2, ids.obj1]);
  assert.deepEqual(adminForm[0].sub_strands[0].learning_outcomes, []);
  assert.equal(await repository.countStrandsBySubject(ids.su1), 2);
  assert.equal(await repository.countStrandsByGrade(ids.g1), 2);
  assert.equal(await repository.countSubStrands(ids.cbc), 2);
  assert.equal(await repository.countLearningOutcomes(ids.cbcSub2), 2);
  assert.deepEqual(await repository.getStrandParent(ids.cbc), { id: ids.cbc, grade_id: ids.g1, subject_id: ids.su1 });
  assert.deepEqual(await repository.getSubStrandParent(ids.cbcSub2), { id: ids.cbcSub2, parent_id: ids.cbc });
  assert.deepEqual(await repository.getLearningOutcomeParent(ids.lo1), { id: ids.lo1, parent_id: ids.cbcSub2 });
  assert.equal(await repository.getStrandParent(randomUUID()), null);
  assert.equal(await repository.getSubStrandParent(randomUUID()), null);
  assert.equal(await repository.getLearningOutcomeParent(randomUUID()), null);

  await assert.rejects(() => getPostgresPool().query("select id from public.strands"), /permission denied/);
  await assert.rejects(() => getPostgresPool().query("select id from public.sub_strands"), /permission denied/);
  await assert.rejects(() => getPostgresPool().query("select id from public.learning_outcomes"), /permission denied/);
  await assert.rejects(() => getPostgresPool().query("select id from public.strand_objectives"), /permission denied/);
});
