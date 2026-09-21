import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("production style source contains generalized conventions only", () => {
  const source = readFileSync(join(process.cwd(), "lib/assessment-style/profiles.ts"), "utf8");
  assert.doesNotMatch(source, /Reference_Pack|teacher\.co|\.pdf|Kenyan_KCSE|Kenyan_Exam/i);
  assert.match(source, /teacher-generated Kenyan assessment/);
});
