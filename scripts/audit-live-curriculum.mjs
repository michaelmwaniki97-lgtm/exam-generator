import { createClient } from "@supabase/supabase-js";

import { loadOfficialCurriculumDocuments } from "./validate-curriculum-data.mjs";

const PAGE_SIZE = 1000;

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en");
}

function findDuplicateKeys(rows, keyFor) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
}

async function fetchAll(client, table, columns) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

function candidateContext(document) {
  return {
    gradeName: document.grade ?? document.form,
    subjectName: document.subject,
  };
}

function collectTopicIds(content) {
  const values = content?.meta?.topicIds;
  return Array.isArray(values)
    ? values.filter((value) => typeof value === "string")
    : [];
}

async function loadOpenApiSchema(url, serviceRoleKey) {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`OpenAPI schema request failed with HTTP ${response.status}`);
  }
  return response.json();
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const countTables = [
    "teachers",
    "admins",
    "subjects",
    "grades",
    "strands",
    "sub_strands",
    "learning_outcomes",
    "textbooks",
    "exams",
    "marking_schemes",
  ];
  const counts = Object.fromEntries(
    await Promise.all(
      countTables.map(async (table) => [table, await countRows(client, table)]),
    ),
  );

  const [
    subjects,
    grades,
    strands,
    subStrands,
    outcomes,
    textbooks,
    exams,
    markingSchemes,
    candidates,
    openApi,
  ] = await Promise.all([
    fetchAll(client, "subjects", "id,name"),
    fetchAll(client, "grades", "id,name,level"),
    fetchAll(client, "strands", "id,subject_id,grade_id,name"),
    fetchAll(client, "sub_strands", "id,strand_id,name"),
    fetchAll(client, "learning_outcomes", "id,sub_strand_id,description"),
    fetchAll(client, "textbooks", "id,subject_id,grade_id"),
    fetchAll(client, "exams", "id,subject_id,grade_id,content"),
    fetchAll(client, "marking_schemes", "id,exam_id"),
    loadOfficialCurriculumDocuments(),
    loadOpenApiSchema(url, serviceRoleKey),
  ]);

  const subjectByName = new Map(subjects.map((row) => [normalize(row.name), row]));
  const gradeByName = new Map(grades.map((row) => [normalize(row.name), row]));
  const strandById = new Map(strands.map((row) => [row.id, row]));
  const subStrandById = new Map(subStrands.map((row) => [row.id, row]));
  const examById = new Map(exams.map((row) => [row.id, row]));

  const candidateContexts = candidates.map(({ document }) =>
    candidateContext(document),
  );
  const affectedContextKeys = new Set();
  const missingCandidateSubjects = new Set();
  const missingCandidateGrades = new Set();
  for (const context of candidateContexts) {
    const subject = subjectByName.get(normalize(context.subjectName));
    const grade = gradeByName.get(normalize(context.gradeName));
    if (!subject) missingCandidateSubjects.add(context.subjectName);
    if (!grade) missingCandidateGrades.add(context.gradeName);
    if (subject && grade) affectedContextKeys.add(`${grade.id}|${subject.id}`);
  }

  const affectedStrandIds = new Set(
    strands
      .filter((row) =>
        affectedContextKeys.has(`${row.grade_id}|${row.subject_id}`),
      )
      .map((row) => row.id),
  );
  const affectedSubStrandIds = new Set(
    subStrands
      .filter((row) => affectedStrandIds.has(row.strand_id))
      .map((row) => row.id),
  );
  const affectedOutcomeIds = new Set(
    outcomes
      .filter((row) => affectedSubStrandIds.has(row.sub_strand_id))
      .map((row) => row.id),
  );

  const topicReferences = exams.flatMap((exam) =>
    collectTopicIds(exam.content).map((subStrandId) => ({
      examId: exam.id,
      subStrandId,
    })),
  );
  const uniqueReferencedSubStrandIds = new Set(
    topicReferences.map((reference) => reference.subStrandId),
  );
  const referencesIntoAffectedData = topicReferences.filter((reference) =>
    affectedSubStrandIds.has(reference.subStrandId),
  );

  const schemas = openApi.components?.schemas ?? openApi.definitions ?? {};
  const inspectedTables = [
    "subjects",
    "grades",
    "strands",
    "sub_strands",
    "learning_outcomes",
    "textbooks",
    "exams",
    "marking_schemes",
  ];
  const liveColumns = Object.fromEntries(
    inspectedTables.map((table) => [
      table,
      Object.keys(schemas[table]?.properties ?? {}).sort(),
    ]),
  );
  const rpcPaths = Object.keys(openApi.paths ?? {})
    .filter((path) => path.startsWith("/rpc/"))
    .sort();

  const summary = {
    auditedAt: new Date().toISOString(),
    mode: "read_only",
    counts,
    referenceDimensions: {
      subjects: subjects
        .map((row) => row.name)
        .sort((left, right) => left.localeCompare(right)),
      grades: grades
        .map((row) => ({ name: row.name, level: row.level }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      missingCandidateSubjects: [...missingCandidateSubjects].sort(),
      missingCandidateGrades: [...missingCandidateGrades].sort(),
    },
    duplicates: {
      subjectsByName: findDuplicateKeys(subjects, (row) => normalize(row.name)),
      gradesByName: findDuplicateKeys(grades, (row) => normalize(row.name)),
      strandsWithinParent: findDuplicateKeys(
        strands,
        (row) => `${row.grade_id}|${row.subject_id}|${normalize(row.name)}`,
      ),
      subStrandsWithinParent: findDuplicateKeys(
        subStrands,
        (row) => `${row.strand_id}|${normalize(row.name)}`,
      ),
      outcomesWithinParent: findDuplicateKeys(
        outcomes,
        (row) => `${row.sub_strand_id}|${normalize(row.description)}`,
      ),
    },
    orphanChecks: {
      strandsWithoutSubject: strands.filter(
        (row) => !subjects.some((subject) => subject.id === row.subject_id),
      ).length,
      strandsWithoutGrade: strands.filter(
        (row) => !grades.some((grade) => grade.id === row.grade_id),
      ).length,
      subStrandsWithoutStrand: subStrands.filter(
        (row) => !strandById.has(row.strand_id),
      ).length,
      outcomesWithoutSubStrand: outcomes.filter(
        (row) => !subStrandById.has(row.sub_strand_id),
      ).length,
      textbooksWithoutSubjectOrGrade: textbooks.filter(
        (row) =>
          !subjects.some((subject) => subject.id === row.subject_id) ||
          !grades.some((grade) => grade.id === row.grade_id),
      ).length,
      markingSchemesWithoutExam: markingSchemes.filter(
        (row) => !examById.has(row.exam_id),
      ).length,
    },
    historicalExamTopicReferences: {
      totalReferences: topicReferences.length,
      uniqueReferencedSubStrandIds: uniqueReferencedSubStrandIds.size,
      missingReferencedSubStrandIds: [...uniqueReferencedSubStrandIds].filter(
        (id) => !subStrandById.has(id),
      ).length,
      referencesIntoCandidateContexts: referencesIntoAffectedData.length,
      examsReferencingCandidateContexts: new Set(
        referencesIntoAffectedData.map((reference) => reference.examId),
      ).size,
    },
    replacementImpactIfCandidateContextsWereDeleted: {
      strands: affectedStrandIds.size,
      subStrands: affectedSubStrandIds.size,
      learningOutcomes: affectedOutcomeIds.size,
      examTopicReferences: referencesIntoAffectedData.length,
    },
    liveColumns,
    rpcPaths,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
