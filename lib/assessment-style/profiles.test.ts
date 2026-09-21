import test from "node:test";
import assert from "node:assert/strict";
import { composeKenyanAssessmentStyle, stylePrompt } from "./profiles.ts";

const cases = [
  ["Grade 6", "Mathematics", "end_term", /accessible instructions/, /working/i],
  ["Grade 8", "Mathematics", "end_term", /competency-oriented/, /coordinate grids/],
  ["Grade 8", "Integrated Science", "cat", /investigation/, /apparatus/],
  ["Grade 9", "English", "kjsea_practice", /component structure/, /original passages/],
  ["Grade 9", "Mathematics", "kjsea_practice", /component structure/, /calculations/],
  ["Form 4", "Mathematics", "mock", /KCSE-style/, /geometry/],
  ["Form 4", "Biology", "mock", /KCSE-style/, /scientifically valid/],
  ["Form 4", "English", "mock", /KCSE-style/, /literature/],
  ["Form 4", "Kiswahili", "mock", /KCSE-style/, /Kiswahili/],
  ["Form 4", "Computer Studies", "mock", /KCSE-style/, /algorithms/],
] as const;
for (const [gradeName, subjectName, examType, levelRule, subjectRule] of cases) test(`${gradeName} ${subjectName} selects a compact appropriate style`, () => {
  const profile = composeKenyanAssessmentStyle({ gradeName, level: gradeName.startsWith("Form") ? "Secondary" : "Junior School", subjectName, examType });
  const prompt = stylePrompt(profile);
  assert.match(prompt, levelRule); assert.match(prompt, subjectRule);
  assert.doesNotMatch(prompt, /Reference_Pack|teacher\.co|past-paper/i);
});
