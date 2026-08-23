import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const assessment = read("./step-assessment.tsx");
const review = read("./step-review.tsx");
const action = read("../../app/actions/exams.ts");
const rules = read("../../lib/assessment/rules.ts");
const blueprintSummary = read("./blueprint-summary.tsx");

test("KJSEA presentation uses KJSEA practice terminology and disclaims issuance", () => {
  assert.match(assessment, /Verified KJSEA practice profile/);
  assert.match(assessment, /school-generated KJSEA-style practice material/);
  assert.match(assessment, /not issued or endorsed by KNEC/);
  assert.match(review, /isKjseaPractice \? "KJSEA" : "KCSE"/);
  assert.match(review, /Verified \$\{isKjseaPractice \? "KJSEA" : "KCSE"\} duration/);
  assert.match(review, /school-generated KJSEA-style practice material/);
});

test("KCSE presentation scopes verification to component identity and duration", () => {
  for (const source of [assessment, review, rules]) {
    assert.doesNotMatch(source, /verified KCSE paper structure/i);
  }
  assert.match(assessment, /Verified KCSE component identity and duration/);
  assert.match(assessment, /Exact marks, sections and question counts remain unknown/);
  assert.match(rules, /Verified KCSE component identities and durations/);
});

test("persisted legacy verification status has an explicit compatible scope", () => {
  assert.match(action, /verificationStatus: component\.verificationStatus/);
  assert.match(action, /verificationStatus: componentRule\.verificationStatus/);
  assert.match(action, /verificationScope:[\s\S]*?"OFFICIAL_PROFILE"/);
  assert.match(action, /"COMPONENT_IDENTITY_AND_DURATION"/);
  assert.match(action, /"SOURCE_REQUIRED"/);
});

test("unknown official section splits are displayed as generation allocations", () => {
  assert.match(blueprintSummary, /generation allocation \(official split unknown\)/);
  assert.match(blueprintSummary, /markAuthority === "GENERATION_FLEXIBLE"/);
});
