import { readFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

import {
  loadOfficialCurriculumDocuments,
  validateCurriculumDocument,
} from "./validate-curriculum-data.mjs";
import { buildCurriculumImportPlan } from "./lib/curriculum-import-plan.mjs";

const { Client } = pg;

const EXPECTED_SNAPSHOT = Object.freeze({
  candidate_documents: 141,
  strands_and_topics: 689,
  sub_strands_and_sub_topics: 3893,
  strand_objectives: 1287,
});

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");
const CHUNK_SIZE = 200;

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en");
}

function chunk(rows, size = CHUNK_SIZE) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function safeConnectionLabel(connectionString) {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`;
  } catch {
    return "configured PostgreSQL database";
  }
}

function assertLocalDatabase(connectionString) {
  if (ALLOW_REMOTE || process.env.ALLOW_REMOTE_CURRICULUM_IMPORT === "1") return;

  const url = new URL(connectionString);
  const host = normalize(url.hostname).replace(/^\[|\]$/g, "");
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

  if (!localHosts.has(host)) {
    throw new Error(
      `Safety stop: DATABASE_URL points to non-local host "${url.hostname}". ` +
        `This recovery script defaults to localhost only. ` +
        `If you intentionally mean a remote database, re-run with --allow-remote.`,
    );
  }
}

async function getColumns(client, table) {
  // Use pg_catalog instead of information_schema.
  // information_schema hides metadata from restricted runtime roles that do
  // not own the tables, even when the tables themselves are visible.
  const { rows } = await client.query(
    `SELECT a.attname AS column_name
       FROM pg_catalog.pg_attribute AS a
       JOIN pg_catalog.pg_class AS c
         ON c.oid = a.attrelid
       JOIN pg_catalog.pg_namespace AS n
         ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [table],
  );
  return new Set(rows.map((row) => row.column_name));
}

async function requireColumns(client, table, required) {
  const columns = await getColumns(client, table);
  const missing = required.filter((column) => !columns.has(column));
  if (missing.length > 0) {
    throw new Error(`${table} is missing required columns: ${missing.join(", ")}`);
  }
  return columns;
}

async function getWritePrivileges(client) {
  const tables = [
    "subjects",
    "strands",
    "sub_strands",
    "strand_objectives",
    "curriculum_source_exceptions",
  ];

  const report = {};

  for (const table of tables) {
    const { rows } = await client.query(
      `SELECT
         has_table_privilege(current_user, format('public.%I', $1::text), 'INSERT') AS can_insert,
         has_table_privilege(current_user, format('public.%I', $1::text), 'UPDATE') AS can_update`,
      [table],
    );

    report[table] = rows[0] ?? { can_insert: false, can_update: false };
  }

  return report;
}

function hasCoreWritePrivileges(report) {
  return ["subjects", "strands", "sub_strands", "strand_objectives"].every(
    (table) => report[table]?.can_insert && report[table]?.can_update,
  );
}

async function batchUpsert(client, table, columns, rows, { updateColumns } = {}) {
  if (rows.length === 0) return 0;

  const updates = updateColumns ?? columns.filter((column) => column !== "id");
  let total = 0;

  for (const group of chunk(rows)) {
    const values = [];
    const params = [];
    let p = 1;

    for (const row of group) {
      const placeholders = [];
      for (const column of columns) {
        let value = row[column] ?? null;
        if (column === "source_metadata" || column === "details") {
          value = value == null ? null : JSON.stringify(value);
        }
        params.push(value);
        placeholders.push(`$${p++}`);
      }
      values.push(`(${placeholders.join(", ")})`);
    }

    const updateSql =
      updates.length === 0
        ? "DO NOTHING"
        : `DO UPDATE SET ${updates
            .map((column) => `${column} = EXCLUDED.${column}`)
            .join(", ")}`;

    await client.query(
      `INSERT INTO public.${table} (${columns.join(", ")})
       VALUES ${values.join(", ")}
       ON CONFLICT (id) ${updateSql}`,
      params,
    );

    total += group.length;
  }

  return total;
}

async function deactivateLegacyInOfficialContexts(client, contexts) {
  const pairs = [];
  const seen = new Set();

  for (const row of contexts) {
    const key = `${row.grade_id}|${row.subject_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([row.grade_id, row.subject_id]);
  }

  let affected = 0;

  for (const group of chunk(pairs, 150)) {
    const params = [];
    const valueSql = [];
    let p = 1;

    for (const [gradeId, subjectId] of group) {
      params.push(gradeId, subjectId);
      valueSql.push(`($${p++}::uuid, $${p++}::uuid)`);
    }

    const { rowCount } = await client.query(
      `UPDATE public.strands AS st
          SET is_active = false
         FROM (VALUES ${valueSql.join(", ")}) AS official_context(grade_id, subject_id)
        WHERE st.grade_id = official_context.grade_id
          AND st.subject_id = official_context.subject_id
          AND st.verification_status = 'unverified'
          AND st.is_active = true`,
      params,
    );

    affected += rowCount ?? 0;
  }

  return affected;
}

async function countIds(client, table, ids, extraWhere = "") {
  if (ids.length === 0) return 0;
  const { rows } = await client.query(
    `SELECT count(*)::int AS count
       FROM public.${table}
      WHERE id = ANY($1::uuid[]) ${extraWhere}`,
    [ids],
  );
  return rows[0]?.count ?? 0;
}

async function countActiveUnverifiedInContexts(client, contexts) {
  const pairs = [];
  const seen = new Set();

  for (const row of contexts) {
    const key = `${row.grade_id}|${row.subject_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([row.grade_id, row.subject_id]);
  }

  let total = 0;

  for (const group of chunk(pairs, 150)) {
    const params = [];
    const valueSql = [];
    let p = 1;

    for (const [gradeId, subjectId] of group) {
      params.push(gradeId, subjectId);
      valueSql.push(`($${p++}::uuid, $${p++}::uuid)`);
    }

    const { rows } = await client.query(
      `SELECT count(*)::int AS count
         FROM public.strands AS st
         JOIN (VALUES ${valueSql.join(", ")}) AS official_context(grade_id, subject_id)
           ON st.grade_id = official_context.grade_id
          AND st.subject_id = official_context.subject_id
        WHERE st.verification_status = 'unverified'
          AND st.is_active = true`,
      params,
    );

    total += rows[0]?.count ?? 0;
  }

  return total;
}

function assertSnapshot(plan) {
  const actual = {
    candidate_documents: plan.expected_counts.candidate_documents,
    strands_and_topics: plan.strands.length,
    sub_strands_and_sub_topics: plan.sub_strands.length,
    strand_objectives: plan.strand_objectives.length,
  };

  const mismatches = Object.entries(EXPECTED_SNAPSHOT)
    .filter(([key, expected]) => actual[key] !== expected)
    .map(([key, expected]) => `${key}: expected ${expected}, got ${actual[key]}`);

  if (mismatches.length > 0) {
    throw new Error(
      `Safety stop: local official JSON snapshot does not match the verified Supabase snapshot.\n` +
        mismatches.join("\n"),
    );
  }
}

async function main() {
  const connectionString =
    process.env.CURRICULUM_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. Run with: node --env-file=.env.local scripts/import-verified-curriculum-postgres.mjs",
    );
  }

  assertLocalDatabase(connectionString);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await requireColumns(client, "grades", ["id", "name"]);
    await requireColumns(client, "subjects", ["id", "name"]);
    await requireColumns(client, "strands", [
      "id",
      "subject_id",
      "grade_id",
      "name",
      "sort_order",
      "source_code",
      "verification_status",
      "outcome_status",
      "source_ref",
      "source_metadata",
      "is_active",
    ]);
    await requireColumns(client, "sub_strands", [
      "id",
      "strand_id",
      "name",
      "sort_order",
      "source_code",
      "verification_status",
      "outcome_status",
      "source_ref",
      "source_metadata",
    ]);
    await requireColumns(client, "strand_objectives", [
      "id",
      "strand_id",
      "description",
      "label",
      "sort_order",
      "verification_status",
      "source_ref",
      "source_metadata",
    ]);

    const [{ rows: liveSubjects }, { rows: liveGrades }] = await Promise.all([
      client.query("SELECT id, name FROM public.subjects ORDER BY name"),
      client.query("SELECT id, name FROM public.grades ORDER BY name"),
    ]);

    const entries = await loadOfficialCurriculumDocuments();
    const validationFailures = entries
      .map(({ file, document }) => ({
        file,
        errors: validateCurriculumDocument(document),
      }))
      .filter((result) => result.errors.length > 0);

    if (validationFailures.length > 0) {
      console.error(JSON.stringify({ validation_failures: validationFailures }, null, 2));
      throw new Error(
        `Official curriculum validation failed for ${validationFailures.length} file(s).`,
      );
    }

    const unavailable = JSON.parse(
      await readFile(
        new URL("../curriculum/source-unavailable/forms-1-4.json", import.meta.url),
        "utf8",
      ),
    );

    const plan = buildCurriculumImportPlan({
      entries,
      unavailableRecords: unavailable.records ?? [],
      liveSubjects,
      liveGrades,
      preconditions: {
        target: "local-postgres-recovery",
        generated_at: new Date().toISOString(),
      },
    });

    assertSnapshot(plan);

    const writePrivileges = await getWritePrivileges(client);
    const coreWriteReady = hasCoreWritePrivileges(writePrivileges);

    const summary = {
      mode: APPLY ? "apply" : "dry_run",
      target: safeConnectionLabel(connectionString),
      database_user: (await client.query("SELECT current_user AS user")).rows[0]?.user,
      dataset_version: plan.dataset_version,
      dataset_hash: plan.dataset_hash,
      expected_counts: plan.expected_counts,
      recovery_snapshot: EXPECTED_SNAPSHOT,
      subjects_required: plan.subjects.length,
      grades_required: plan.grades.length,
      contexts: plan.contexts.length,
      core_write_privileges_ready: coreWriteReady,
      write_privileges: writePrivileges,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (!APPLY) {
      console.log(
        "\nDRY RUN ONLY — no database rows changed.\n" +
          (coreWriteReady
            ? "The current database role has the required core write privileges."
            : "The current database role does NOT have all required core write privileges. " +
              "Do not use --apply with this role; use an authorized migration/admin PostgreSQL role instead."),
      );
      return;
    }

    if (!coreWriteReady) {
      throw new Error(
        "Safety stop: current PostgreSQL role lacks INSERT/UPDATE privileges on one or more core curriculum tables. " +
          "Use an authorized migration/admin database role for --apply.",
      );
    }

    await client.query("BEGIN");

    try {
      // Insert only missing subjects. Existing local subject IDs are preserved by the plan.
      const existingSubjectIds = new Set(liveSubjects.map((row) => row.id));
      const missingSubjects = plan.subjects.filter(
        (row) => !existingSubjectIds.has(row.id),
      );

      await batchUpsert(client, "subjects", ["id", "name"], missingSubjects);

      // Hide legacy curriculum only where a verified source-backed context exists.
      // Nothing is deleted.
      const legacyDeactivated = await deactivateLegacyInOfficialContexts(
        client,
        plan.contexts,
      );

      await batchUpsert(
        client,
        "strands",
        [
          "id",
          "subject_id",
          "grade_id",
          "name",
          "sort_order",
          "source_code",
          "verification_status",
          "outcome_status",
          "source_ref",
          "source_metadata",
          "is_active",
        ],
        plan.strands.map((row) => ({ ...row, is_active: true })),
      );

      await batchUpsert(
        client,
        "sub_strands",
        [
          "id",
          "strand_id",
          "name",
          "sort_order",
          "source_code",
          "verification_status",
          "outcome_status",
          "source_ref",
          "source_metadata",
        ],
        plan.sub_strands,
      );

      await batchUpsert(
        client,
        "strand_objectives",
        [
          "id",
          "strand_id",
          "description",
          "label",
          "sort_order",
          "verification_status",
          "source_ref",
          "source_metadata",
        ],
        plan.strand_objectives,
      );

      // Optional source-exception audit table: populate it only if the local schema has
      // the expected columns. This does not affect teacher curriculum reads.
      const exceptionColumns = await getColumns(client, "curriculum_source_exceptions");
      const canWriteExceptions = [
        "id",
        "grade_id",
        "subject_id",
        "status",
        "details",
      ].every((column) => exceptionColumns.has(column));

      if (canWriteExceptions) {
        await batchUpsert(
          client,
          "curriculum_source_exceptions",
          ["id", "grade_id", "subject_id", "status", "details"],
          plan.source_exceptions,
        );
      }

      const verification = {
        active_planned_strands: await countIds(
          client,
          "strands",
          plan.strands.map((row) => row.id),
          "AND is_active = true",
        ),
        planned_sub_strands: await countIds(
          client,
          "sub_strands",
          plan.sub_strands.map((row) => row.id),
        ),
        planned_strand_objectives: await countIds(
          client,
          "strand_objectives",
          plan.strand_objectives.map((row) => row.id),
        ),
        active_unverified_in_official_contexts:
          await countActiveUnverifiedInContexts(client, plan.contexts),
      };

      if (verification.active_planned_strands !== plan.strands.length) {
        throw new Error(
          `Verification failed: expected ${plan.strands.length} active planned strands/topics, found ${verification.active_planned_strands}.`,
        );
      }
      if (verification.planned_sub_strands !== plan.sub_strands.length) {
        throw new Error(
          `Verification failed: expected ${plan.sub_strands.length} sub-strands/sub-topics, found ${verification.planned_sub_strands}.`,
        );
      }
      if (
        verification.planned_strand_objectives !== plan.strand_objectives.length
      ) {
        throw new Error(
          `Verification failed: expected ${plan.strand_objectives.length} objectives, found ${verification.planned_strand_objectives}.`,
        );
      }
      if (verification.active_unverified_in_official_contexts !== 0) {
        throw new Error(
          `Verification failed: ${verification.active_unverified_in_official_contexts} active legacy topics remain in official contexts.`,
        );
      }

      await client.query("COMMIT");

      console.log(
        JSON.stringify(
          {
            status: "COMPLETE",
            legacy_topics_deactivated_not_deleted: legacyDeactivated,
            verification,
          },
          null,
          2,
        ),
      );

      console.log(
        "\nOfficial curriculum restore completed successfully. " +
          "Refresh the Create Exam page and spot-check several grades/subjects.",
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\nIMPORT FAILED — database transaction was rolled back.");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
