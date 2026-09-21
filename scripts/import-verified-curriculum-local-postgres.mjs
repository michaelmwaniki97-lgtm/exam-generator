import { readFile } from "node:fs/promises";
import pg from "pg";

import {
  loadOfficialCurriculumDocuments,
  validateCurriculumDocument,
} from "./validate-curriculum-data.mjs";
import { buildCurriculumImportPlan } from "./lib/curriculum-import-plan.mjs";
import { importVerifiedCurriculum } from "./database-rpc.mjs";

const { Client } = pg;

const APPLY = process.argv.includes("--apply");
const ALLOW_REMOTE = process.argv.includes("--allow-remote");

const LOCKED = Object.freeze({
  candidate_documents: 141,
  official_contexts: 141,
  cbc_contexts: 117,
  form_contexts: 24,
  strands_and_topics: 689,
  sub_strands_and_sub_topics: 3893,
  strand_objectives: 1287,
  source_exceptions: 4,
  form_topics: 191,
  form_sub_topics: 1101,
});

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en");
}

function connectionLabel(connectionString) {
  const url = new URL(connectionString);
  return `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`;
}

function assertLocalTarget(connectionString) {
  if (ALLOW_REMOTE) return;
  const url = new URL(connectionString);
  const host = normalize(url.hostname).replace(/^\[|\]$/g, "");
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(host)) {
    throw new Error(
      `Safety stop: target host "${url.hostname}" is not local. ` +
        `Use --allow-remote only if that is intentional.`,
    );
  }
}

async function fetchAll(client, sql) {
  const { rows } = await client.query(sql);
  return rows;
}

async function preconditions(client) {
  const tables = [
    "subjects",
    "grades",
    "strands",
    "sub_strands",
    "learning_outcomes",
    "textbooks",
    "exams",
    "marking_schemes",
  ];

  const result = {};
  for (const table of tables) {
    const { rows } = await client.query(
      `SELECT count(*)::bigint::text AS count FROM public.${table}`,
    );
    result[table] = Number(rows[0].count);
  }
  return result;
}

async function verifyServiceRoleHandshake(client) {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL ROLE service_role");
    await client.query(
      "SELECT set_config($1, $2, true)",
      ["request.jwt.claim.role", "service_role"],
    );
    const { rows } = await client.query(
      "SELECT current_user AS current_user, auth.role() AS auth_role",
    );
    await client.query("ROLLBACK");

    const check = rows[0];
    if (check?.current_user !== "service_role" || check?.auth_role !== "service_role") {
      throw new Error(
        `service_role handshake failed: current_user=${check?.current_user}, auth.role()=${check?.auth_role}`,
      );
    }
    return check;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  }
}

function assertLockedCounts(plan) {
  const contextById = new Map(plan.contexts.map((row) => [row.id, row]));
  const formStrandIds = new Set(
    plan.strands
      .filter(
        (row) => contextById.get(row.context_id)?.education_system === "8-4-4",
      )
      .map((row) => row.id),
  );

  const actual = {
    candidate_documents: plan.expected_counts.candidate_documents,
    official_contexts: plan.expected_counts.official_contexts,
    cbc_contexts: plan.expected_counts.cbc_contexts,
    form_contexts: plan.expected_counts.form_contexts,
    strands_and_topics: plan.expected_counts.strands_and_topics,
    sub_strands_and_sub_topics:
      plan.expected_counts.sub_strands_and_sub_topics,
    strand_objectives: plan.expected_counts.strand_objectives,
    source_exceptions: plan.expected_counts.source_exceptions,
    form_topics: formStrandIds.size,
    form_sub_topics: plan.sub_strands.filter((row) =>
      formStrandIds.has(row.strand_id),
    ).length,
  };

  const errors = Object.entries(LOCKED)
    .filter(([key, expected]) => actual[key] !== expected)
    .map(([key, expected]) => `${key}: expected ${expected}, got ${actual[key]}`);

  if (errors.length) {
    throw new Error(
      "Locked verified curriculum totals do not match:\n" + errors.join("\n"),
    );
  }

  return actual;
}

async function countPlanned(client, table, ids, extra = "") {
  const { rows } = await client.query(
    `SELECT count(*)::int AS count
       FROM public.${table}
      WHERE id = ANY($1::uuid[]) ${extra}`,
    [ids],
  );
  return rows[0].count;
}

async function activeLegacyInOfficialContexts(client, contexts) {
  const unique = [];
  const seen = new Set();

  for (const row of contexts) {
    const key = `${row.grade_id}|${row.subject_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ grade_id: row.grade_id, subject_id: row.subject_id });
    }
  }

  const { rows } = await client.query(
    `WITH ctx AS (
       SELECT *
       FROM jsonb_to_recordset($1::jsonb)
         AS x(grade_id uuid, subject_id uuid)
     )
     SELECT count(*)::int AS count
       FROM public.strands s
       JOIN ctx
         ON ctx.grade_id = s.grade_id
        AND ctx.subject_id = s.subject_id
      WHERE s.is_active
        AND s.verification_status = 'unverified'`,
    [JSON.stringify(unique)],
  );

  return rows[0].count;
}

async function main() {
  const connectionString =
    process.env.CURRICULUM_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "CURRICULUM_DATABASE_URL or DATABASE_URL is required.",
    );
  }

  assertLocalTarget(connectionString);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const identity = (
      await client.query(
        "SELECT current_database() AS database, current_user AS database_user",
      )
    ).rows[0];

    const roleHandshake = await verifyServiceRoleHandshake(client);

    const [
      subjects,
      grades,
      strands,
      subStrands,
      outcomes,
      exams,
      counts,
    ] = await Promise.all([
      fetchAll(client, "SELECT id, name FROM public.subjects ORDER BY name"),
      fetchAll(client, "SELECT id, name, level FROM public.grades ORDER BY name"),
      fetchAll(
        client,
        "SELECT id, subject_id, grade_id, name FROM public.strands ORDER BY id",
      ),
      fetchAll(
        client,
        "SELECT id, strand_id, name FROM public.sub_strands ORDER BY id",
      ),
      fetchAll(
        client,
        "SELECT id, sub_strand_id, description FROM public.learning_outcomes ORDER BY id",
      ),
      fetchAll(client, "SELECT id, content FROM public.exams ORDER BY id"),
      preconditions(client),
    ]);

    const entries = await loadOfficialCurriculumDocuments();
    const failures = entries
      .map(({ file, document }) => ({
        file,
        errors: validateCurriculumDocument(document),
      }))
      .filter((row) => row.errors.length);

    if (failures.length) {
      throw new Error(
        `Candidate validation failed for ${failures.length} official file(s).`,
      );
    }

    const unavailable = JSON.parse(
      await readFile(
        new URL(
          "../curriculum/source-unavailable/forms-1-4.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );

    const plan = buildCurriculumImportPlan({
      entries,
      unavailableRecords: unavailable.records,
      liveSubjects: subjects,
      liveGrades: grades,
      preconditions: counts,
    });

    const lockedCounts = assertLockedCounts(plan);

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? "apply" : "dry_run",
          target: connectionLabel(connectionString),
          database: identity.database,
          database_user: identity.database_user,
          service_role_handshake: roleHandshake,
          dataset_version: plan.dataset_version,
          dataset_hash: plan.dataset_hash,
          locked_counts: lockedCounts,
          preconditions: counts,
          live_snapshot: {
            subjects: subjects.length,
            grades: grades.length,
            strands: strands.length,
            sub_strands: subStrands.length,
            learning_outcomes: outcomes.length,
            exams: exams.length,
          },
        },
        null,
        2,
      ),
    );

    if (!APPLY) {
      console.log(
        "\nDRY RUN ONLY — no curriculum rows changed. " +
          "This used the local PostgreSQL snapshot and verified the exact service_role handshake.",
      );
      return;
    }

    // The repo's existing database-rpc.mjs uses DATABASE_URL and DATABASE_BACKEND.
    // Point it at the exact local/admin connection that passed preflight above.
    process.env.DATABASE_BACKEND = "postgres";
    process.env.DATABASE_URL = connectionString;

    const result = await importVerifiedCurriculum(null, plan);

    const importRow = (
      await client.query(
        `SELECT id, dataset_hash, status, summary
           FROM public.curriculum_imports
          WHERE dataset_hash = $1`,
        [plan.dataset_hash],
      )
    ).rows[0];

    if (!importRow || importRow.status !== "complete") {
      throw new Error("Post-import verification could not find a complete curriculum_imports row.");
    }

    const verification = {
      import_id: importRow.id,
      active_planned_strands: await countPlanned(
        client,
        "strands",
        plan.strands.map((row) => row.id),
        "AND is_active = true",
      ),
      planned_sub_strands: await countPlanned(
        client,
        "sub_strands",
        plan.sub_strands.map((row) => row.id),
      ),
      planned_strand_objectives: await countPlanned(
        client,
        "strand_objectives",
        plan.strand_objectives.map((row) => row.id),
      ),
      active_unverified_in_official_contexts:
        await activeLegacyInOfficialContexts(client, plan.contexts),
      import_status: importRow.status,
    };

    if (verification.active_planned_strands !== plan.strands.length) {
      throw new Error(
        `Expected ${plan.strands.length} active planned strands/topics, found ${verification.active_planned_strands}.`,
      );
    }
    if (verification.planned_sub_strands !== plan.sub_strands.length) {
      throw new Error(
        `Expected ${plan.sub_strands.length} planned sub-strands/sub-topics, found ${verification.planned_sub_strands}.`,
      );
    }
    if (verification.planned_strand_objectives !== plan.strand_objectives.length) {
      throw new Error(
        `Expected ${plan.strand_objectives.length} planned objectives, found ${verification.planned_strand_objectives}.`,
      );
    }
    if (verification.active_unverified_in_official_contexts !== 0) {
      throw new Error(
        `${verification.active_unverified_in_official_contexts} active legacy topics remain in official contexts.`,
      );
    }

    console.log(
      JSON.stringify(
        {
          status: "COMPLETE",
          import_result: result,
          verification,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("\nLOCAL VERIFIED CURRICULUM IMPORT FAILED");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
