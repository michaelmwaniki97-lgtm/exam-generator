import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  getSchoolAssessmentType,
  resolveAssessmentRules,
  type AssessmentContext,
  type ExamStructure,
  type SchoolAssessmentTypeId,
} from "./rules.ts";
import { resolveAssessmentProfile } from "./profiles.ts";

function resolve(options: {
  gradeName: string;
  level: string;
  subjectName: string;
  assessmentType: SchoolAssessmentTypeId;
  structure?: ExamStructure;
  componentCode?: string;
  marks?: number;
  duration?: number;
}) {
  const educationSystem = options.gradeName.startsWith("Form") ? "8-4-4" : "CBC";
  const context: AssessmentContext = {
    educationSystem,
    level: options.level,
    gradeName: options.gradeName,
    subjectName: options.subjectName,
  };
  const structure = options.structure ?? "standard";
  const rules = resolveAssessmentRules(context, options.assessmentType, structure);
  const component = options.componentCode
    ? rules.officialComponentRule?.components.find((item) => item.paperCode === options.componentCode) ?? null
    : null;
  return resolveAssessmentProfile({
    educationSystem,
    level: options.level,
    gradeName: options.gradeName,
    subjectName: options.subjectName,
    assessmentType: getSchoolAssessmentType(options.assessmentType)!.id,
    examStructure: structure,
    component,
    requestedMarks: options.marks ?? 30,
    requestedDurationMinutes: options.duration ?? 45,
  });
}

test("ordinary Grade 9 Mathematics CAT stays a school heuristic", () => {
  const profile = resolve({ gradeName: "Grade 9", level: "Junior School", subjectName: "Mathematics", assessmentType: "cat" });
  assert.equal(profile.ruleStatus, "SCHOOL_HEURISTIC");
  assert.equal(profile.paper.paperCode, null);
});

test("KJSEA Mathematics 903 has exact verified allocation", () => {
  const profile = resolve({ gradeName: "Grade 9", level: "Junior School", subjectName: "Mathematics", assessmentType: "kjsea_practice", structure: "kjsea_style", componentCode: "903", marks: 12, duration: 20 });
  assert.equal(profile.ruleStatus, "OFFICIAL_VERIFIED");
  assert.deepEqual([profile.paper.paperCode, profile.paper.totalMarks, profile.paper.durationMinutes], ["903", 100, 120]);
  assert.deepEqual(profile.sections.map((section) => [section.id, section.marks, section.questionCount?.exact ?? null]), [["section-a", 20, 20], ["section-b", 80, null]]);
  assert.equal(profile.sections[0].fixedFamilyCounts?.objective, 20);
});

test("KJSEA language components resolve distinctly", () => {
  for (const [subjectName, codes] of [["English", ["901/1", "901/2"]], ["Kiswahili", ["902/1", "902/2"]]] as const) {
    const profiles = codes.map((componentCode) => resolve({ gradeName: "Grade 9", level: "Junior School", subjectName, assessmentType: "kjsea_practice", structure: "kjsea_style", componentCode }));
    assert.notEqual(profiles[0].profileId, profiles[1].profileId);
    assert.deepEqual(profiles.map((profile) => profile.paper.paperCode), codes);
  }
});

test("verified KJSEA science and humanities components retain exact known rules", () => {
  const cases = [
    ["Integrated Science", "905/1", 70, 100, 2],
    ["Integrated Science", "905/2", 30, 60, 3],
    ["Social Studies", "907", 100, 90, 2],
    ["Christian Religious Education", "908", 100, 90, 2],
  ] as const;
  for (const [subjectName, componentCode, marks, duration, sectionCount] of cases) {
    const profile = resolve({ gradeName: "Grade 9", level: "Junior School", subjectName, assessmentType: "kjsea_practice", structure: "kjsea_style", componentCode });
    assert.deepEqual([profile.paper.totalMarks, profile.paper.durationMinutes, profile.sections.length], [marks, duration, sectionCount]);
  }
});

test("ordinary Form assessments never silently become KCSE", () => {
  const cat = resolve({ gradeName: "Form 3", level: "Secondary", subjectName: "Chemistry", assessmentType: "cat" });
  const endTerm = resolve({ gradeName: "Form 4", level: "Secondary", subjectName: "Chemistry", assessmentType: "end_term" });
  assert.equal(cat.ruleStatus, "SCHOOL_HEURISTIC");
  assert.equal(endTerm.ruleStatus, "SCHOOL_HEURISTIC");
});

test("Form 4 Chemistry Mock component preserves verified identity but unknown exact rules", () => {
  const profile = resolve({ gradeName: "Form 4", level: "Secondary", subjectName: "Chemistry", assessmentType: "mock", structure: "kcse_style", componentCode: "233/2", marks: 80, duration: 120 });
  assert.equal(profile.ruleStatus, "UNKNOWN");
  assert.equal(profile.paper.paperCode, "233/2");
  assert.equal(profile.paper.totalMarks, null);
  assert.deepEqual(profile.sections, []);
});

test("server action reconstructs the profile and never reads client profile metadata", () => {
  const action = readFileSync(new URL("../../app/actions/exams.ts", import.meta.url), "utf8");
  assert.match(action, /resolveAssessmentProfile\(\{/);
  assert.doesNotMatch(action, /data\.(assessmentProfile|authority|profileId)/);
});

test("direct KJSEA resolution rejects a non-KJSEA assessment mode", () => {
  const context: AssessmentContext = {
    educationSystem: "CBC",
    level: "Junior School",
    gradeName: "Grade 9",
    subjectName: "Mathematics",
  };
  const kjseaRules = resolveAssessmentRules(
    context,
    "kjsea_practice",
    "kjsea_style"
  );
  const component = kjseaRules.officialComponentRule?.components[0];
  assert.ok(component);
  assert.equal(
    resolveAssessmentRules(context, "cat", "kjsea_style").officialComponentRule,
    null
  );
  assert.throws(
    () =>
      resolveAssessmentProfile({
        educationSystem: "CBC",
        level: "Junior School",
        gradeName: "Grade 9",
        subjectName: "Mathematics",
        assessmentType: "cat",
        examStructure: "kjsea_style",
        component,
        requestedMarks: 100,
        requestedDurationMinutes: 120,
      }),
    /canonical KJSEA Practice assessment mode/
  );
});
