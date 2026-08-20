import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadOfficialCurriculumDocuments,
  validateCurriculumDocument,
  validateOfficialCurriculumData,
} from "./validate-curriculum-data.mjs";

async function grade5Cre() {
  const entries = await loadOfficialCurriculumDocuments();
  return entries.find(
    ({ document }) =>
      document.grade === "Grade 5" &&
      document.subject === "Christian Religious Education",
  ).document;
}

async function form1Biology() {
  const entries = await loadOfficialCurriculumDocuments();
  return entries.find(
    ({ document }) =>
      document.form === "Form 1" && document.subject === "Biology",
  ).document;
}

test("all 117 CBC and 24 Form candidates pass structural validation", async () => {
  const results = await validateOfficialCurriculumData();

  assert.equal(results.length, 141);
  assert.deepEqual(
    results.filter((result) => result.errors.length > 0),
    [],
  );
});

test("candidate coverage matches every official Grade 1-9 subject combination", async () => {
  const entries = await loadOfficialCurriculumDocuments();
  const counts = Object.groupBy(
    entries.filter(({ document }) => document.educationSystem === "CBC"),
    ({ document }) => document.grade,
  );

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(counts).map(([grade, gradeEntries]) => [
        grade,
        gradeEntries.length,
      ]),
    ),
    {
      "Grade 1": 8,
      "Grade 2": 8,
      "Grade 3": 8,
      "Grade 4": 15,
      "Grade 5": 15,
      "Grade 6": 15,
      "Grade 7": 16,
      "Grade 8": 16,
      "Grade 9": 16,
    },
  );
});

test("official Form candidates cover six sourced subjects in every Form", async () => {
  const entries = await loadOfficialCurriculumDocuments();
  const formEntries = entries.filter(
    ({ document }) => document.educationSystem === "8-4-4",
  );
  const counts = Object.groupBy(formEntries, ({ document }) => document.form);

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(counts).map(([form, documents]) => [
        form,
        documents.length,
      ]),
    ),
    { "Form 1": 6, "Form 2": 6, "Form 3": 6, "Form 4": 6 },
  );
  assert.ok(
    formEntries.every(({ document }) => document.subject !== "Kiswahili"),
  );
});

test("Form candidate preserves official topic, sub-topic, and objective hierarchy", async () => {
  const document = await form1Biology();

  assert.equal(document.topics[0].code, "1.0.0");
  assert.equal(document.topics[0].name, "INTRODUCTION TO BIOLOGY");
  assert.equal(document.topics[0].subTopics[0].code, "1.2.1");
  assert.equal(document.topics[0].subTopics[0].name, "Definition of biology");
  assert.equal(document.topics[0].objectives[0].text, "define biology");
});

test("textbook-only source cannot claim OFFICIAL Form verification", async () => {
  const document = structuredClone(await form1Biology());
  document.source.sourceType = "approved_kenyan_textbook";

  assert.ok(
    validateCurriculumDocument(document).some((error) =>
      error.includes("textbook-only evidence cannot claim OFFICIAL"),
    ),
  );
});

test("published duplicate Form codes require a discrepancy marker", async () => {
  const document = structuredClone(await form1Biology());
  const duplicate = structuredClone(document.topics[0].subTopics[0]);
  duplicate.order = document.topics[0].subTopics.length + 1;
  document.topics[0].subTopics.push(duplicate);

  assert.ok(
    validateCurriculumDocument(document).some((error) =>
      error.includes("duplicate code:"),
    ),
  );
});

test("sourced Form objectives cannot be empty", async () => {
  const document = structuredClone(await form1Biology());
  document.topics[0].objectives = [];

  assert.ok(
    validateCurriculumDocument(document).some((error) =>
      error.includes("objectives must be a non-empty sourced array"),
    ),
  );
});

test("Grade 5 CRE preserves the verified KICD hierarchy and ordering", async () => {
  const document = await grade5Cre();

  assert.equal(document.strands.length, 5);
  assert.equal(
    document.strands.reduce(
      (total, strand) => total + strand.subStrands.length,
      0,
    ),
    30,
  );
  assert.deepEqual(
    document.strands.map((strand) => strand.code),
    ["1.0", "2.0", "3.0", "4.0", "5.0"],
  );
  assert.deepEqual(
    document.strands.map((strand) => strand.name),
    [
      "Creation",
      "The Bible",
      "The Life of Jesus Christ",
      "The Church",
      "Christian Living",
    ],
  );
});

test("validator rejects duplicate official codes within the same parent", async () => {
  const document = await grade5Cre();
  const duplicate = structuredClone(document);
  duplicate.strands[0].subStrands.push({
    order: duplicate.strands[0].subStrands.length + 1,
    code: duplicate.strands[0].subStrands[0].code,
    name: "Different published name",
  });

  assert.ok(
    validateCurriculumDocument(duplicate).some((error) =>
      error.includes("duplicate code:"),
    ),
  );
});

test("validator rejects malformed hierarchy codes", async () => {
  const document = await grade5Cre();
  const incorrectlyNumbered = structuredClone(document);
  incorrectlyNumbered.strands[1].subStrands[0].code = "generated-code";

  assert.ok(
    validateCurriculumDocument(incorrectlyNumbered).some((error) =>
      error.includes("must use an official numeric hierarchy code"),
    ),
  );
});

test("validator prevents unverified learning outcomes from being imported", async () => {
  const document = await grade5Cre();
  const fabricated = structuredClone(document);
  fabricated.learningOutcomes = ["A generated outcome"];

  assert.ok(
    validateCurriculumDocument(fabricated).some((error) =>
      error.includes("learningOutcomes must be omitted"),
    ),
  );
});

test("all Form records are closed and the matrix has no pending items", async () => {
  const unavailable = JSON.parse(
    await readFile(
      new URL("../curriculum/source-unavailable/forms-1-4.json", import.meta.url),
      "utf8",
    ),
  );
  const progress = await readFile(
    new URL("../docs/curriculum-verification-progress.md", import.meta.url),
    "utf8",
  );

  assert.equal(unavailable.records.length, 4);
  assert.ok(
    unavailable.records.every(
      (record) =>
        record.subject === "Kiswahili" &&
        record.status === "SOURCE UNAVAILABLE",
    ),
  );
  assert.match(
    progress,
    /28 of 28 processed; 24 OFFICIAL VERIFIED; 4 SOURCE UNAVAILABLE; 0 pending/,
  );
});
