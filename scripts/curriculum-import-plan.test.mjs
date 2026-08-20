import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCurriculumImportPlan,
  deterministicUuid,
} from "./lib/curriculum-import-plan.mjs";
import { loadOfficialCurriculumDocuments } from "./validate-curriculum-data.mjs";

async function buildPlan() {
  const entries = await loadOfficialCurriculumDocuments();
  const unavailable = JSON.parse(
    await readFile(
      new URL("../curriculum/source-unavailable/forms-1-4.json", import.meta.url),
      "utf8",
    ),
  );
  const subjectNames = new Set(entries.map(({ document }) => document.subject));
  for (const record of unavailable.records) subjectNames.add(record.subject);
  const gradeNames = new Set(
    entries.map(({ document }) => document.grade ?? document.form),
  );
  const liveSubjects = [...subjectNames].map((name) => ({
    id: deterministicUuid(`test-live-subject:${name}`),
    name,
  }));
  const liveGrades = [...gradeNames].map((name) => ({
    id: deterministicUuid(`test-live-grade:${name}`),
    name,
    level: name.startsWith("Form") ? "Secondary" : "Test",
  }));
  return buildCurriculumImportPlan({
    entries,
    unavailableRecords: unavailable.records,
    liveSubjects,
    liveGrades,
    preconditions: {
      subjects: liveSubjects.length,
      grades: liveGrades.length,
      strands: 0,
      sub_strands: 0,
      learning_outcomes: 0,
      textbooks: 0,
      exams: 0,
      marking_schemes: 0,
    },
  });
}

test("deterministic UUIDs are stable RFC 4122 version-5-shaped values", () => {
  const first = deterministicUuid("example");
  assert.equal(first, deterministicUuid("example"));
  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("import plan locks the verified milestone totals without fabricated outcomes", async () => {
  const plan = await buildPlan();
  const contextById = new Map(plan.contexts.map((row) => [row.id, row]));
  const formStrandIds = new Set(
    plan.strands
      .filter(
        (row) => contextById.get(row.context_id).education_system === "8-4-4",
      )
      .map((row) => row.id),
  );

  assert.equal(plan.contexts.length, 141);
  assert.equal(
    plan.contexts.filter((row) => row.education_system === "CBC").length,
    117,
  );
  assert.equal(
    plan.contexts.filter((row) => row.education_system === "8-4-4").length,
    24,
  );
  assert.equal(formStrandIds.size, 191);
  assert.equal(
    plan.sub_strands.filter((row) => formStrandIds.has(row.strand_id)).length,
    1101,
  );
  assert.equal(plan.strand_objectives.length, 1287);
  assert.equal(plan.expected_counts.learning_outcomes, 0);
  assert.equal(plan.source_exceptions.length, 4);
});

test("plan preserves repeated official wording while using parent order as identity", async () => {
  const plan = await buildPlan();
  const context = plan.contexts.find((row) => {
    const grade = plan.grades.find((candidate) => candidate.id === row.grade_id);
    const subject = plan.subjects.find((candidate) => candidate.id === row.subject_id);
    return grade?.name === "Grade 2" && subject?.name === "English Activities";
  });
  assert.ok(context);
  const writingRows = plan.strands.filter(
    (row) => row.context_id === context.id && row.name === "Writing",
  );
  assert.equal(writingRows.length, 2);
  assert.deepEqual(
    writingRows.map((row) => row.sort_order),
    [4, 5],
  );
});

test("every planned record has a unique deterministic UUID and source trace", async () => {
  const plan = await buildPlan();
  const rows = [
    ...plan.contexts,
    ...plan.strands,
    ...plan.sub_strands,
    ...plan.strand_objectives,
    ...plan.source_exceptions,
  ];
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  assert.ok(plan.strands.every((row) => row.source_ref && row.source_code !== undefined));
  assert.ok(plan.sub_strands.every((row) => row.source_ref && row.source_code !== undefined));
  assert.ok(plan.strand_objectives.every((row) => row.source_ref));
});
