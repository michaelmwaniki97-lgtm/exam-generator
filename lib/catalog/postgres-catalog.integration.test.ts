import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, getPostgresPool, queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import { PostgresCatalogRepository } from "./postgres.ts";

const USER = "00000000-0000-4000-8000-000000000006";

test("direct PostgreSQL catalog preserves authenticated contracts", async (context) => {
  context.after(closePostgresPool);
  const catalog = new PostgresCatalogRepository(USER);
  const wizardGrades = await catalog.listWizardGrades();
  assert.ok(wizardGrades.length > 0);
  assert.ok(wizardGrades.every((row) => Object.keys(row).sort().join() === "id,level,name,sort_order"));
  assert.deepEqual(wizardGrades.map((row) => row.sort_order), [...wizardGrades].map((row) => row.sort_order).sort((a, b) => a - b));

  const grades = await catalog.listGradesByCreation();
  const gradeOptions = await catalog.listGradeOptionsByName();
  const gradeNames = await catalog.listGradeNames();
  const subjects = await catalog.listSubjectsByName();
  const subjectNames = await catalog.listSubjectNames();
  assert.ok(grades.length > 0 && subjects.length > 0);
  assert.equal(gradeNames.length, grades.length);
  assert.equal(subjectNames.length, subjects.length);
  const expectedGradeNames = await withAuthenticatedTransaction(USER, (client) =>
    queryRows<{ name: string }>(client, "select name from public.grades order by name", [])
  );
  const expectedSubjectNames = await withAuthenticatedTransaction(USER, (client) =>
    queryRows<{ name: string }>(client, "select name from public.subjects order by name", [])
  );
  assert.deepEqual(gradeOptions.map((row) => row.name), expectedGradeNames.map((row) => row.name));
  assert.deepEqual(subjects.map((row) => row.name), expectedSubjectNames.map((row) => row.name));
  assert.equal(new Set(subjects.map((row) => row.id)).size, subjects.length);
  assert.equal(await catalog.countSubjects(), subjects.length);
  assert.deepEqual(await catalog.getGradeById(grades[0].id), grades[0]);
  assert.deepEqual(await catalog.getSubjectById(subjects[0].id), subjects[0]);
  assert.equal(await catalog.gradeExists(grades[0].id), true);
  assert.equal(await catalog.subjectExists(subjects[0].id), true);
  assert.equal(await catalog.getGradeById(randomUUID()), null);
  assert.equal(await catalog.getSubjectById(randomUUID()), null);
  assert.equal(await catalog.gradeExists(randomUUID()), false);
  assert.equal(await catalog.subjectExists(randomUUID()), false);

  await assert.rejects(() => getPostgresPool().query("select id from public.grades"), /permission denied/);
  await assert.rejects(() => getPostgresPool().query("select id from public.subjects"), /permission denied/);
});
