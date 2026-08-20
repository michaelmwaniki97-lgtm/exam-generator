import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

import {
  loadOfficialCurriculumDocuments,
  validateCurriculumDocument,
} from "./validate-curriculum-data.mjs";
import { buildCurriculumImportPlan } from "./lib/curriculum-import-plan.mjs";

const PAGE_SIZE = 1000;
const REQUIRED_COUNTS = {
  cbc_contexts: 117,
  form_contexts: 24,
  form_topics: 191,
  form_sub_topics: 1101,
  form_objectives: 1287,
  source_exceptions: 4,
};

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en");
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

async function loadOpenApi(url, key) {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`OpenAPI request failed: HTTP ${response.status}`);
  return response.json();
}

function tableColumns(openApi, table) {
  const schemas = openApi.components?.schemas ?? openApi.definitions ?? {};
  return new Set(Object.keys(schemas[table]?.properties ?? {}));
}

function schemaReadiness(openApi) {
  const strandColumns = tableColumns(openApi, "strands");
  const subStrandColumns = tableColumns(openApi, "sub_strands");
  const requiredStrandColumns = [
    "sort_order",
    "source_code",
    "verification_status",
    "outcome_status",
    "source_ref",
    "source_metadata",
    "is_active",
    "curriculum_import_id",
  ];
  const requiredSubStrandColumns = [
    "sort_order",
    "source_code",
    "verification_status",
    "outcome_status",
    "source_ref",
    "source_metadata",
  ];
  const missing = [
    ...requiredStrandColumns
      .filter((column) => !strandColumns.has(column))
      .map((column) => `strands.${column}`),
    ...requiredSubStrandColumns
      .filter((column) => !subStrandColumns.has(column))
      .map((column) => `sub_strands.${column}`),
  ];
  for (const table of [
    "strand_objectives",
    "curriculum_imports",
    "curriculum_import_legacy_records",
    "curriculum_source_exceptions",
  ]) {
    if (tableColumns(openApi, table).size === 0) missing.push(table);
  }
  if (!Object.hasOwn(openApi.paths ?? {}, "/rpc/import_verified_curriculum")) {
    missing.push("rpc/import_verified_curriculum");
  }
  return { ready: missing.length === 0, missing };
}

function candidateTotals(plan) {
  const contextById = new Map(plan.contexts.map((row) => [row.id, row]));
  const formStrandIds = new Set(
    plan.strands
      .filter(
        (row) => contextById.get(row.context_id)?.education_system === "8-4-4",
      )
      .map((row) => row.id),
  );
  return {
    cbc_contexts: plan.expected_counts.cbc_contexts,
    form_contexts: plan.expected_counts.form_contexts,
    form_topics: formStrandIds.size,
    form_sub_topics: plan.sub_strands.filter((row) =>
      formStrandIds.has(row.strand_id),
    ).length,
    form_objectives: plan.strand_objectives.length,
    source_exceptions: plan.source_exceptions.length,
  };
}

function assertRequiredCounts(totals) {
  for (const [label, expected] of Object.entries(REQUIRED_COUNTS)) {
    if (totals[label] !== expected) {
      throw new Error(`${label}: expected ${expected}, found ${totals[label]}`);
    }
  }
}

function historicalTopicIds(exams) {
  return exams.flatMap((exam) => {
    const ids = exam.content?.meta?.topicIds;
    return Array.isArray(ids)
      ? ids.filter((value) => typeof value === "string")
      : [];
  });
}

function replacementImpact(plan, live) {
  const officialContextKeys = new Set(
    plan.contexts.map((row) => `${row.grade_id}|${row.subject_id}`),
  );
  const affectedStrandIds = new Set(
    live.strands
      .filter((row) =>
        officialContextKeys.has(`${row.grade_id}|${row.subject_id}`),
      )
      .map((row) => row.id),
  );
  const affectedSubStrandIds = new Set(
    live.subStrands
      .filter((row) => affectedStrandIds.has(row.strand_id))
      .map((row) => row.id),
  );
  const topicIds = historicalTopicIds(live.exams);
  return {
    legacy_strands_retained_inactive: affectedStrandIds.size,
    legacy_sub_strands_retained: affectedSubStrandIds.size,
    legacy_learning_outcomes_retained: live.outcomes.filter((row) =>
      affectedSubStrandIds.has(row.sub_strand_id),
    ).length,
    historical_exam_topic_references_preserved: topicIds.filter((id) =>
      affectedSubStrandIds.has(id),
    ).length,
    historical_exams_preserved: new Set(
      live.exams
        .filter((exam) =>
          historicalTopicIds([exam]).some((id) => affectedSubStrandIds.has(id)),
        )
        .map((exam) => exam.id),
    ).size,
  };
}

async function verifyAfterApply(client, plan, beforeTopicIds) {
  const [activeOfficialStrands, allSubStrandIds, imports] = await Promise.all([
    fetchAll(
      client,
      "strands",
      "id,verification_status,is_active,curriculum_import_id",
    ),
    fetchAll(client, "sub_strands", "id"),
    fetchAll(client, "curriculum_imports", "id,dataset_hash,status"),
  ]);
  const subStrandIds = new Set(allSubStrandIds.map((row) => row.id));
  const matchingImport = imports.find((row) => row.dataset_hash === plan.dataset_hash);
  const missingHistoricalIds = [...new Set(beforeTopicIds)].filter(
    (id) => !subStrandIds.has(id),
  );
  const officialActiveCount = activeOfficialStrands.filter(
    (row) =>
      row.is_active &&
      row.verification_status !== "unverified" &&
      row.curriculum_import_id === matchingImport?.id,
  ).length;
  if (!matchingImport || matchingImport.status !== "complete") {
    throw new Error("Post-import verification could not find a complete import audit row");
  }
  if (officialActiveCount !== plan.strands.length) {
    throw new Error(
      `Post-import verification expected ${plan.strands.length} active official strands/topics, found ${officialActiveCount}`,
    );
  }
  if (missingHistoricalIds.length > 0) {
    throw new Error(
      `Post-import verification found ${missingHistoricalIds.length} missing historical topic UUIDs`,
    );
  }
  return {
    import_id: matchingImport.id,
    active_official_strands_and_topics: officialActiveCount,
    missing_historical_topic_uuids: 0,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const entries = await loadOfficialCurriculumDocuments();
  const validationFailures = entries
    .map(({ file, document }) => ({
      file,
      errors: validateCurriculumDocument(document),
    }))
    .filter((result) => result.errors.length > 0);
  if (validationFailures.length > 0) {
    throw new Error(
      `Candidate validation failed for ${validationFailures.length} files; import stopped`,
    );
  }
  const unavailable = JSON.parse(
    await readFile(
      new URL("../curriculum/source-unavailable/forms-1-4.json", import.meta.url),
      "utf8",
    ),
  );

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const countTables = [
    "subjects",
    "grades",
    "strands",
    "sub_strands",
    "learning_outcomes",
    "textbooks",
    "exams",
    "marking_schemes",
  ];
  const [subjects, grades, strands, subStrands, outcomes, exams, openApi] =
    await Promise.all([
      fetchAll(client, "subjects", "id,name"),
      fetchAll(client, "grades", "id,name,level"),
      fetchAll(client, "strands", "id,subject_id,grade_id,name"),
      fetchAll(client, "sub_strands", "id,strand_id,name"),
      fetchAll(client, "learning_outcomes", "id,sub_strand_id,description"),
      fetchAll(client, "exams", "id,content"),
      loadOpenApi(url, key),
    ]);
  const preconditions = Object.fromEntries(
    await Promise.all(
      countTables.map(async (table) => [table, await countRows(client, table)]),
    ),
  );
  const plan = buildCurriculumImportPlan({
    entries,
    unavailableRecords: unavailable.records,
    liveSubjects: subjects,
    liveGrades: grades,
    preconditions,
  });
  const totals = candidateTotals(plan);
  assertRequiredCounts(totals);

  const live = { subjects, grades, strands, subStrands, outcomes, exams };
  const readiness = schemaReadiness(openApi);
  const missingSubjects = plan.subjects
    .filter(
      (planned) =>
        !subjects.some((existing) => normalize(existing.name) === normalize(planned.name)),
    )
    .map((row) => row.name);
  const report = {
    mode: apply ? "apply" : "dry_run",
    status: readiness.ready ? "READY" : "BLOCKED_SCHEMA_MIGRATION_REQUIRED",
    dataset_version: plan.dataset_version,
    dataset_hash: plan.dataset_hash,
    candidate_totals: totals,
    expected_import_counts: plan.expected_counts,
    new_subjects: missingSubjects,
    source_required: {
      cbc_specific_learning_outcomes: "not_imported",
      form_3_cre_topics_without_objectives: 6,
      kiswahili_forms: plan.source_exceptions.length,
    },
    preservation_plan: replacementImpact(plan, live),
    schema_missing: readiness.missing,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!apply) return;
  if (!readiness.ready) {
    throw new Error(
      "Safe import stopped: apply migration 20260816170000_prepare_verified_curriculum_import.sql first",
    );
  }

  const beforeTopicIds = historicalTopicIds(exams);
  const { data, error } = await client.rpc("import_verified_curriculum", {
    p_payload: plan,
  });
  if (error) throw new Error(`Transactional import failed: ${error.message}`);
  const verification = await verifyAfterApply(client, plan, beforeTopicIds);
  console.log(JSON.stringify({ import_result: data, verification }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
