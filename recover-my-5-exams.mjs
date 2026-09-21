import { writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const EXPORT_URL =
  "https://thjjwnpsexwaajtavsvv.supabase.co/functions/v1/exam-recovery-export-20260831?token=JgY2pN9uU_FKpAIrOl-yb2esEFNtsCBHD1Z_pWjo7zA";

const SOURCE_TEACHER_ID = "8a6a276d-e9cc-48e8-832e-cc4254baee30";
const LOCAL_TEACHER_ID = "785f9bbe-1f50-4d77-8f37-af2289ac87e0";

const EXPECTED_EXAMS = new Set([
  "d3e8b126-1b85-4425-b031-74e0737e32c2",
  "6badc832-82b4-4372-8c29-54b7ddb156c3",
  "dc9dc46e-fa60-4f81-bef8-8c7ec677a5cc",
  "dbec7951-0e8c-413f-9cf2-df94c640912f",
  "85ed5bd4-9e2f-4ab3-a016-b20a5c9873b7",
]);

const PSQL =
  process.env.PSQL_PATH ??
  "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function toBase64Json(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function assertRecoveryPayload(payload) {
  if (!payload || payload.teacher_id !== SOURCE_TEACHER_ID) {
    throw new Error("Recovery export returned the wrong source teacher.");
  }

  if (!Array.isArray(payload.exams) || payload.exams.length !== 5) {
    throw new Error(
      `Expected exactly 5 original exams, received ${payload?.exams?.length ?? 0}.`
    );
  }

  const ids = new Set(payload.exams.map((exam) => exam.id));
  for (const id of EXPECTED_EXAMS) {
    if (!ids.has(id)) throw new Error(`Missing expected original exam ${id}.`);
  }
  for (const exam of payload.exams) {
    if (!EXPECTED_EXAMS.has(exam.id)) {
      throw new Error(`Unexpected exam in export: ${exam.id}.`);
    }
    if (!exam.marking_scheme?.id || !exam.marking_scheme?.content) {
      throw new Error(`Exam ${exam.id} is missing its original marking scheme.`);
    }
    if (!exam.grade_name || !exam.subject_name || !exam.content) {
      throw new Error(`Exam ${exam.id} is missing required original data.`);
    }
  }
}

function examSql(exam) {
  const examB64 = toBase64Json(exam.content);
  const markingB64 = toBase64Json(exam.marking_scheme.content);
  const generationKey =
    exam.generation_request_key == null
      ? "NULL"
      : `${sqlString(exam.generation_request_key)}::uuid`;

  return `
DO $recover$
DECLARE
  v_teacher uuid := '${LOCAL_TEACHER_ID}';
  v_grade uuid;
  v_subject uuid;
BEGIN
  SELECT id
    INTO v_grade
    FROM public.grades
   WHERE lower(name) = lower(${sqlString(exam.grade_name)})
   ORDER BY id
   LIMIT 1;

  IF v_grade IS NULL THEN
    RAISE EXCEPTION 'Missing local grade: ${String(exam.grade_name).replaceAll("'", "''")}';
  END IF;

  SELECT id
    INTO v_subject
    FROM public.subjects
   WHERE lower(name) = lower(${sqlString(exam.subject_name)})
   ORDER BY id
   LIMIT 1;

  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'Missing local subject: ${String(exam.subject_name).replaceAll("'", "''")}';
  END IF;

  INSERT INTO public.exams (
    id,
    teacher_id,
    subject_id,
    grade_id,
    exam_type,
    marks,
    duration,
    difficulty,
    content,
    status,
    created_at,
    term,
    year,
    revision,
    generation_request_key
  )
  VALUES (
    '${exam.id}'::uuid,
    v_teacher,
    v_subject,
    v_grade,
    ${sqlString(exam.exam_type)},
    ${Number(exam.marks)},
    ${Number(exam.duration)},
    ${sqlString(exam.difficulty)},
    convert_from(decode('${examB64}', 'base64'), 'UTF8')::jsonb,
    ${sqlString(exam.status)},
    ${sqlString(exam.created_at)}::timestamptz,
    ${sqlString(exam.term)},
    ${exam.year == null ? "NULL" : Number(exam.year)},
    ${Number(exam.revision)},
    ${generationKey}
  )
  ON CONFLICT (id) DO UPDATE SET
    teacher_id = EXCLUDED.teacher_id,
    subject_id = EXCLUDED.subject_id,
    grade_id = EXCLUDED.grade_id,
    exam_type = EXCLUDED.exam_type,
    marks = EXCLUDED.marks,
    duration = EXCLUDED.duration,
    difficulty = EXCLUDED.difficulty,
    content = EXCLUDED.content,
    status = EXCLUDED.status,
    created_at = EXCLUDED.created_at,
    term = EXCLUDED.term,
    year = EXCLUDED.year,
    revision = EXCLUDED.revision,
    generation_request_key = EXCLUDED.generation_request_key;

  INSERT INTO public.marking_schemes (
    id,
    exam_id,
    content,
    created_at
  )
  VALUES (
    '${exam.marking_scheme.id}'::uuid,
    '${exam.id}'::uuid,
    convert_from(decode('${markingB64}', 'base64'), 'UTF8')::jsonb,
    ${sqlString(exam.marking_scheme.created_at)}::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    exam_id = EXCLUDED.exam_id,
    content = EXCLUDED.content,
    created_at = EXCLUDED.created_at;
END
$recover$;
`;
}

async function main() {
  console.log("Fetching your 5 original exams from the old Supabase database...");
  const response = await fetch(EXPORT_URL, {
    headers: { "cache-control": "no-store" },
  });

  if (!response.ok) {
    throw new Error(`Recovery export failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  assertRecoveryPayload(payload);

  const ordered = [...payload.exams].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );

  const ids = ordered.map((exam) => `'${exam.id}'::uuid`).join(", ");

  const sql = `\\set ON_ERROR_STOP on
BEGIN;
${ordered.map(examSql).join("\n")}
COMMIT;

-- Recovery verification: this must show exactly 5 rows and every
-- has_marking_scheme value must be true.
SELECT
  e.id,
  g.name AS grade,
  s.name AS subject,
  e.exam_type,
  e.marks,
  e.status,
  (ms.id IS NOT NULL) AS has_marking_scheme
FROM public.exams e
JOIN public.grades g ON g.id = e.grade_id
JOIN public.subjects s ON s.id = e.subject_id
LEFT JOIN public.marking_schemes ms ON ms.exam_id = e.id
WHERE e.id IN (${ids})
ORDER BY e.created_at;
`;

  const sqlPath = new URL("./recover-my-5-exams.sql", import.meta.url);
  await writeFile(sqlPath, sql, "utf8");

  console.log("");
  console.log("Verified export: exactly 5 original exams + 5 original marking schemes.");
  console.log("Created recover-my-5-exams.sql");
  console.log("");

  if (!process.argv.includes("--apply")) {
    console.log("Run with --apply to import them into local Postgres:");
    console.log("  node .\\recover-my-5-exams.mjs --apply");
    return;
  }

  console.log("Importing into local PostgreSQL. Enter the postgres password if prompted...");
  const result = spawnSync(
    PSQL,
    [
      "-U",
      "postgres",
      "-d",
      "exam_generator",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      new URL("./recover-my-5-exams.sql", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    ],
    { stdio: "inherit", shell: false }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`psql exited with code ${result.status}`);
  }

  console.log("");
  console.log("Recovery finished.");
}

main().catch((error) => {
  console.error("");
  console.error("RECOVERY FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
