import { createHash } from "node:crypto";
import { relative } from "node:path";

const UUID_NAMESPACE = "exam-generator:official-curriculum:v1";

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function deterministicUuid(key) {
  const bytes = createHash("sha256")
    .update(`${UUID_NAMESPACE}:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function uniqueByNormalizedName(rows, label) {
  const byName = new Map();
  for (const row of rows) {
    const key = normalize(row.name);
    if (byName.has(key)) {
      throw new Error(`Duplicate live ${label} name: ${row.name}`);
    }
    byName.set(key, row);
  }
  return byName;
}

function verificationStatus(document) {
  return document.verificationStatus === "TEXTBOOK-VERIFIED / KICD SOURCE PENDING"
    ? "textbook_verified_kicd_pending"
    : "verified_official";
}

function sourcePages(node) {
  if (Array.isArray(node.sourcePages)) return node.sourcePages;
  return Number.isInteger(node.sourcePage) ? [node.sourcePage] : [];
}

function sourceMetadata(node) {
  return {
    source_pages: sourcePages(node),
    ...(node.sourceCode ? { source_code_as_printed: node.sourceCode } : {}),
    ...(node.sourceDiscrepancy
      ? { source_discrepancy: node.sourceDiscrepancy }
      : {}),
  };
}

function assertUnique(rows, keyFor, label) {
  const seen = new Set();
  for (const row of rows) {
    const key = keyFor(row);
    if (seen.has(key)) throw new Error(`Duplicate ${label}: ${key}`);
    seen.add(key);
  }
}

function candidateFile(file) {
  return relative(process.cwd(), file).replaceAll("\\", "/");
}

export function buildCurriculumImportPlan({
  entries,
  unavailableRecords,
  liveSubjects,
  liveGrades,
  preconditions,
}) {
  const subjectByName = uniqueByNormalizedName(liveSubjects, "subject");
  const gradeByName = uniqueByNormalizedName(liveGrades, "grade");
  const requiredSubjectNames = new Set(entries.map(({ document }) => document.subject));
  for (const record of unavailableRecords) requiredSubjectNames.add(record.subject);

  const subjects = [...requiredSubjectNames]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      id:
        subjectByName.get(normalize(name))?.id ??
        deterministicUuid(`subject:${normalize(name)}`),
      name,
    }));
  const plannedSubjectByName = new Map(
    subjects.map((subject) => [normalize(subject.name), subject]),
  );

  const requiredGradeNames = new Set(
    entries.map(({ document }) => document.grade ?? document.form),
  );
  for (const record of unavailableRecords) {
    requiredGradeNames.add(record.form ?? record.grade);
  }
  const missingGrades = [...requiredGradeNames].filter(
    (name) => !gradeByName.has(normalize(name)),
  );
  if (missingGrades.length > 0) {
    throw new Error(
      `Required grades/classes are missing from the live database: ${missingGrades.join(", ")}`,
    );
  }

  const grades = [...requiredGradeNames]
    .map((name) => gradeByName.get(normalize(name)))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((grade) => ({ id: grade.id, name: grade.name }));

  const contexts = [];
  const strands = [];
  const subStrands = [];
  const strandObjectives = [];
  const sourceManifest = [];

  for (const { file, document } of entries) {
    const gradeName = document.grade ?? document.form;
    const grade = gradeByName.get(normalize(gradeName));
    const subject = plannedSubjectByName.get(normalize(document.subject));
    const sourceRef = candidateFile(file);
    const status = verificationStatus(document);
    const contextId = deterministicUuid(
      `context:${normalize(gradeName)}:${normalize(document.subject)}`,
    );
    contexts.push({
      id: contextId,
      grade_id: grade.id,
      subject_id: subject.id,
      education_system: document.educationSystem,
      verification_status: status,
      outcome_status:
        document.educationSystem === "CBC"
          ? document.outcomeStatus
          : document.objectiveStatus,
      source_ref: sourceRef,
    });
    sourceManifest.push({
      source_ref: sourceRef,
      education_system: document.educationSystem,
      grade_or_form: gradeName,
      subject: document.subject,
      verification_status: document.verificationStatus,
      source: document.source,
    });

    const hierarchy =
      document.educationSystem === "CBC" ? document.strands : document.topics;
    for (const parent of hierarchy) {
      const strandId = deterministicUuid(
        `strand:${contextId}:${parent.code}:${parent.name}`,
      );
      strands.push({
        id: strandId,
        context_id: contextId,
        grade_id: grade.id,
        subject_id: subject.id,
        name: parent.name,
        sort_order: parent.order,
        source_code: parent.code,
        verification_status: status,
        outcome_status:
          document.educationSystem === "CBC"
            ? document.outcomeStatus
            : parent.objectiveStatus,
        source_ref: sourceRef,
        source_metadata: sourceMetadata(parent),
      });

      const children =
        document.educationSystem === "CBC"
          ? parent.subStrands
          : parent.subTopics;
      for (const child of children) {
        subStrands.push({
          id: deterministicUuid(
            `sub-strand:${strandId}:${child.code}:${child.name}`,
          ),
          strand_id: strandId,
          name: child.name,
          sort_order: child.order,
          source_code: child.code,
          verification_status: status,
          outcome_status:
            document.educationSystem === "CBC"
              ? document.outcomeStatus
              : child.objectiveStatus,
          source_ref: sourceRef,
          source_metadata: sourceMetadata(child),
        });
      }

      if (document.educationSystem === "8-4-4") {
        for (const objective of parent.objectives ?? []) {
          strandObjectives.push({
            id: deterministicUuid(
              `strand-objective:${strandId}:${objective.order}:${objective.label}:${objective.text}`,
            ),
            strand_id: strandId,
            description: objective.text,
            label: objective.label,
            sort_order: objective.order,
            verification_status: status,
            source_ref: sourceRef,
            source_metadata: sourceMetadata(objective),
          });
        }
      }
    }
  }

  const sourceExceptions = unavailableRecords.map((record) => {
    const gradeName = record.form ?? record.grade;
    const grade = gradeByName.get(normalize(gradeName));
    const subject = plannedSubjectByName.get(normalize(record.subject));
    return {
      id: deterministicUuid(
        `source-exception:${normalize(gradeName)}:${normalize(record.subject)}`,
      ),
      grade_id: grade.id,
      subject_id: subject.id,
      status: "source_unavailable",
      details: record,
    };
  });

  assertUnique(contexts, (row) => `${row.grade_id}|${row.subject_id}`, "context");
  assertUnique(
    strands,
    (row) => `${row.grade_id}|${row.subject_id}|${row.sort_order}`,
    "strand/topic official order within parent context",
  );
  assertUnique(
    subStrands,
    (row) => `${row.strand_id}|${row.sort_order}`,
    "sub-strand/sub-topic official order within parent",
  );
  assertUnique(
    strandObjectives,
    (row) => `${row.strand_id}|${normalize(row.description)}`,
    "topic objective within parent",
  );

  const datasetMaterial = canonicalize({
    candidates: entries.map(({ file, document }) => ({
      file: candidateFile(file),
      document,
    })),
    source_exceptions: unavailableRecords,
  });
  const datasetHash = sha256(JSON.stringify(datasetMaterial));
  const expectedCounts = {
    candidate_documents: entries.length,
    official_contexts: contexts.length,
    cbc_contexts: contexts.filter((row) => row.education_system === "CBC").length,
    form_contexts: contexts.filter((row) => row.education_system === "8-4-4").length,
    strands_and_topics: strands.length,
    sub_strands_and_sub_topics: subStrands.length,
    strand_objectives: strandObjectives.length,
    learning_outcomes: 0,
    source_exceptions: sourceExceptions.length,
  };

  return {
    schema_version: 1,
    dataset_version: `official-curriculum-${datasetHash.slice(0, 12)}`,
    dataset_hash: datasetHash,
    preconditions,
    expected_counts: expectedCounts,
    subjects,
    grades,
    contexts,
    strands,
    sub_strands: subStrands,
    strand_objectives: strandObjectives,
    source_exceptions: sourceExceptions,
    source_manifest: sourceManifest,
  };
}
