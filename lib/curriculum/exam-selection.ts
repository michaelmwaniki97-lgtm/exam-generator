export type CurriculumVerificationStatus =
  | "unverified"
  | "verified_official"
  | "textbook_verified_kicd_pending";

export type ExamSubStrand = {
  id: string;
  name: string;
  sort_order: number;
  source_code: string | null;
  verification_status: CurriculumVerificationStatus;
  source_ref: string | null;
};

export type ExamStrand = {
  id: string;
  name: string;
  sort_order: number;
  source_code: string | null;
  verification_status: CurriculumVerificationStatus;
  source_ref: string | null;
  sub_strands: ExamSubStrand[];
};

export type CurriculumStrandRow = Omit<ExamStrand, "sub_strands"> & {
  is_active: boolean;
  sub_strands?: Array<Partial<ExamSubStrand> & Pick<ExamSubStrand, "id" | "name">>;
};

export type SubjectAvailability = {
  id: string;
  name: string;
  verification_status: CurriculumVerificationStatus;
};

export type SubjectContextRow = {
  grade_id: string;
  subject_id: string;
  is_active: boolean;
  verification_status: CurriculumVerificationStatus;
  subject: { id: string; name: string } | null;
};

export type SelectedCurriculumRow = {
  id: string;
  name: string;
  sort_order: number;
  source_ref: string | null;
  verification_status: CurriculumVerificationStatus;
  strand: {
    id: string;
    name: string;
    sort_order: number;
    grade_id: string;
    subject_id: string;
    is_active: boolean;
    source_ref: string | null;
    verification_status: CurriculumVerificationStatus;
  } | null;
};

export type CurriculumSelectionSnapshot = {
  strandId: string;
  strandName: string;
  verificationStatus: CurriculumVerificationStatus;
  sourceRef: string | null;
  subStrands: Array<{
    id: string;
    name: string;
    verificationStatus: CurriculumVerificationStatus;
    sourceRef: string | null;
  }>;
};

function leastVerified(
  values: readonly CurriculumVerificationStatus[]
): CurriculumVerificationStatus {
  if (values.includes("unverified")) return "unverified";
  if (values.includes("textbook_verified_kicd_pending")) {
    return "textbook_verified_kicd_pending";
  }
  return "verified_official";
}

export function deriveAvailableSubjects(
  rows: readonly SubjectContextRow[],
  gradeId: string
): SubjectAvailability[] {
  const grouped = new Map<
    string,
    { subject: { id: string; name: string }; statuses: CurriculumVerificationStatus[] }
  >();

  for (const row of rows) {
    if (!row.is_active || row.grade_id !== gradeId || !row.subject) continue;
    const current = grouped.get(row.subject_id) ?? {
      subject: row.subject,
      statuses: [],
    };
    current.statuses.push(row.verification_status);
    grouped.set(row.subject_id, current);
  }

  return [...grouped.values()]
    .map(({ subject, statuses }) => ({
      ...subject,
      verification_status: leastVerified(statuses),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function orderActiveCurriculum(rows: readonly CurriculumStrandRow[]): ExamStrand[] {
  return rows
    .filter((strand) => strand.is_active)
    .map((strand) => ({
      id: strand.id,
      name: strand.name,
      sort_order: strand.sort_order ?? 0,
      source_code: strand.source_code ?? null,
      verification_status: strand.verification_status ?? "unverified",
      source_ref: strand.source_ref ?? null,
      sub_strands: [...(strand.sub_strands ?? [])]
        .map((subStrand) => ({
          id: subStrand.id,
          name: subStrand.name,
          sort_order: subStrand.sort_order ?? 0,
          source_code: subStrand.source_code ?? null,
          verification_status: subStrand.verification_status ?? "unverified",
          source_ref: subStrand.source_ref ?? null,
        }))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

export function validateNewExamCurriculumSelection({
  gradeId,
  subjectId,
  selectedIds,
  rows,
}: {
  gradeId: string;
  subjectId: string;
  selectedIds: readonly string[];
  rows: readonly SelectedCurriculumRow[];
}): string | null {
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (selectedIds.some((id) => !byId.has(id))) {
    return "One or more selected curriculum records no longer exist.";
  }

  for (const id of selectedIds) {
    const row = byId.get(id)!;
    if (!row.strand?.is_active) {
      return "Inactive legacy curriculum cannot be used for a new exam.";
    }
    if (row.strand.grade_id !== gradeId || row.strand.subject_id !== subjectId) {
      return "Selected curriculum does not belong to the chosen class and subject.";
    }
  }

  return null;
}

export function buildCurriculumSelectionSnapshot(
  rows: readonly SelectedCurriculumRow[]
): CurriculumSelectionSnapshot[] {
  const ordered = [...rows].sort(
    (a, b) =>
      (a.strand?.sort_order ?? 0) - (b.strand?.sort_order ?? 0) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name)
  );
  const grouped = new Map<string, CurriculumSelectionSnapshot>();

  for (const row of ordered) {
    if (!row.strand) continue;
    const strand = grouped.get(row.strand.id) ?? {
      strandId: row.strand.id,
      strandName: row.strand.name,
      verificationStatus: row.strand.verification_status,
      sourceRef: row.strand.source_ref,
      subStrands: [],
    };
    strand.subStrands.push({
      id: row.id,
      name: row.name,
      verificationStatus: row.verification_status,
      sourceRef: row.source_ref,
    });
    grouped.set(row.strand.id, strand);
  }

  return [...grouped.values()];
}

export function resolveHistoricalCurriculumReferences(
  rows: readonly SelectedCurriculumRow[],
  selectedIds: readonly string[]
): SelectedCurriculumRow[] {
  const selected = new Set(selectedIds);
  return rows.filter((row) => selected.has(row.id));
}
