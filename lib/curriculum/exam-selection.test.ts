import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveAvailableSubjects,
  orderActiveCurriculum,
  resolveHistoricalCurriculumReferences,
  validateNewExamCurriculumSelection,
  type SelectedCurriculumRow,
} from "./exam-selection.ts";

test("subject availability is grade-specific, active-only, and visibly least-verified", () => {
  const subjects = deriveAvailableSubjects(
    [
      {
        grade_id: "grade-3",
        subject_id: "math",
        is_active: true,
        verification_status: "verified_official",
        subject: { id: "math", name: "Mathematics" },
      },
      {
        grade_id: "grade-3",
        subject_id: "math",
        is_active: true,
        verification_status: "unverified",
        subject: { id: "math", name: "Mathematics" },
      },
      {
        grade_id: "grade-3",
        subject_id: "english",
        is_active: false,
        verification_status: "unverified",
        subject: { id: "english", name: "English" },
      },
      {
        grade_id: "grade-4",
        subject_id: "science",
        is_active: true,
        verification_status: "verified_official",
        subject: { id: "science", name: "Science and Technology" },
      },
    ],
    "grade-3"
  );

  assert.deepEqual(subjects, [
    {
      id: "math",
      name: "Mathematics",
      verification_status: "unverified",
    },
  ]);
});

test("active curriculum preserves source order instead of alphabetical order", () => {
  const ordered = orderActiveCurriculum([
    {
      id: "second",
      name: "Alpha",
      sort_order: 2,
      source_code: null,
      source_ref: "source",
      verification_status: "verified_official",
      is_active: true,
      sub_strands: [],
    },
    {
      id: "first",
      name: "Zulu",
      sort_order: 1,
      source_code: null,
      source_ref: "source",
      verification_status: "verified_official",
      is_active: true,
      sub_strands: [
        { id: "child-2", name: "A", sort_order: 2 },
        { id: "child-1", name: "Z", sort_order: 1 },
      ],
    },
    {
      id: "inactive",
      name: "Hidden legacy root",
      sort_order: 0,
      source_code: null,
      source_ref: null,
      verification_status: "unverified",
      is_active: false,
      sub_strands: [],
    },
  ]);

  assert.deepEqual(ordered.map((strand) => strand.id), ["first", "second"]);
  assert.deepEqual(
    ordered[0].sub_strands.map((subStrand) => subStrand.id),
    ["child-1", "child-2"]
  );
});

function selectionRow(overrides: Partial<SelectedCurriculumRow> = {}): SelectedCurriculumRow {
  return {
    id: "sub",
    name: "Sub-topic",
    sort_order: 1,
    source_ref: "source",
    verification_status: "verified_official",
    strand: {
      id: "strand",
      name: "Topic",
      sort_order: 1,
      grade_id: "grade",
      subject_id: "subject",
      is_active: true,
      source_ref: "source",
      verification_status: "verified_official",
    },
    ...overrides,
  };
}

test("server curriculum validation rejects wrong parents and inactive legacy roots", () => {
  assert.equal(
    validateNewExamCurriculumSelection({
      gradeId: "grade",
      subjectId: "subject",
      selectedIds: ["sub"],
      rows: [selectionRow()],
    }),
    null
  );
  assert.match(
    validateNewExamCurriculumSelection({
      gradeId: "different-grade",
      subjectId: "subject",
      selectedIds: ["sub"],
      rows: [selectionRow()],
    }) ?? "",
    /does not belong/
  );
  assert.match(
    validateNewExamCurriculumSelection({
      gradeId: "grade",
      subjectId: "subject",
      selectedIds: ["sub"],
      rows: [selectionRow({ strand: { ...selectionRow().strand!, is_active: false } })],
    }) ?? "",
    /Inactive legacy/
  );
});

test("historical reference resolution retains inactive curriculum UUIDs", () => {
  const inactive = selectionRow({
    strand: { ...selectionRow().strand!, is_active: false },
  });
  assert.deepEqual(
    resolveHistoricalCurriculumReferences([inactive], [inactive.id]),
    [inactive]
  );
});
