import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

function sourceFiles(relativeDirectory: string): string[] {
  const directory = path.join(root, relativeDirectory);
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    const relativePath = path.relative(root, absolutePath);
    if (statSync(absolutePath).isDirectory()) return sourceFiles(relativePath);
    return /\.(?:ts|tsx)$/.test(entry) ? [relativePath] : [];
  });
}

test("browser code exposes only public Supabase configuration", () => {
  const browserClient = read("lib/supabase/client.ts");
  assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(browserClient, /SERVICE_ROLE|NVIDIA_API_KEY/);

  const adminClient = read("lib/supabase/admin.ts");
  assert.match(adminClient, /^import "server-only";/);
  assert.match(adminClient, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(adminClient, /NEXT_PUBLIC_SUPABASE_SERVICE/);
  assert.match(read("lib/supabase/server.ts"), /^import "server-only";/);

  for (const file of [...sourceFiles("app"), ...sourceFiles("components")]) {
    const source = read(file);
    if (!/^\s*["']use client["'];/m.test(source)) continue;
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|NVIDIA_API_KEY|DATABASE_URL/, file);
    assert.doesNotMatch(
      source,
      /@\/lib\/supabase\/(?:admin|server)|@\/lib\/ai\/(?:client|config)|@\/lib\/db(?:\/|["'])/,
      file
    );
  }
});

test("every repository application table enables RLS", () => {
  const migrations = readdirSync(path.join(root, "supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .map((file) => read(`supabase/migrations/${file}`))
    .join("\n")
    .toLowerCase();

  const tables = [
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
    "payments",
    "app_settings",
    "strand_objectives",
    "curriculum_imports",
    "curriculum_import_legacy_records",
    "curriculum_source_exceptions",
  ];

  for (const table of tables) {
    assert.match(
      migrations,
      new RegExp(`alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`),
      `${table} must enable RLS`
    );
  }
});

test("authenticated clients cannot bypass canonical exam persistence", () => {
  const migration = read(
    "supabase/migrations/20260816200000_security_pass_a_lock_server_mutations.sql"
  );
  assert.match(migration, /drop policy if exists exams_insert_own/);
  assert.match(migration, /revoke insert, update, delete on public\.exams from authenticated/);
  assert.match(
    migration,
    /revoke insert, update, delete on public\.marking_schemes from authenticated/
  );
  assert.match(
    migration,
    /grant update \(name, school, phone\) on public\.teachers to authenticated/
  );

  const action = read("app/actions/exams.ts");
  const generation = action.slice(action.indexOf("export async function generateExam"));
  assert.ok(generation.indexOf("auth.getUser()") < generation.indexOf("claimFullGeneration"));
  assert.ok(generation.indexOf("auth.getUser()") < generation.indexOf("persistGeneratedExam"));
  assert.ok(generation.indexOf('.eq("user_id", user.id)') < generation.indexOf("claimFullGeneration"));
  assert.match(generation, /claimFullGeneration\(teacher\.id, requestId\)/);
  assert.match(generation, /persistGeneratedExam\(\{\s*teacherId: teacher\.id/);
  assert.doesNotMatch(generation, /teacherId:\s*data\.|claimFullGeneration\(data\./);
  assert.match(action, /buildExamBlueprint\(\{/);
  assert.match(action, /validateNewExamCurriculumSelection\(\{/);

  const abuseControls = read("lib/ai/abuse-controls.ts");
  const databaseFactory = read("lib/db/index.ts");
  const databaseConfig = read("lib/db/config.ts");
  const postgresClient = read("lib/db/postgres-client.ts");
  for (const source of [abuseControls, databaseFactory, databaseConfig, postgresClient]) {
    assert.match(source, /^import "server-only";/);
  }
  assert.match(abuseControls, /getTrustedRpcDatabase\(\)\.claimAiGeneration/);
  assert.match(abuseControls, /getTrustedRpcDatabase\(\)\.persistGeneratedExam/);
  assert.match(databaseFactory, /export function getTrustedRpcDatabase\(\): TrustedRpcDatabase/);
  assert.doesNotMatch(databaseFactory, /getTrustedRpcDatabase\([^)]/);
  assert.match(databaseConfig, /process\.env\.DATABASE_BACKEND/);
  assert.doesNotMatch(databaseConfig, /cookies\(|headers\(|request|searchParams|formData/);
  assert.match(postgresClient, /set local role service_role/);
  assert.match(postgresClient, /set local role authenticated/);
  assert.match(postgresClient, /"request\.jwt\.claim\.sub", userId/);
});

test("admin actions share the central server-side role gate", () => {
  const actions = read("app/actions/admin.ts");
  const exportedActions = actions.match(/export async function /g) ?? [];
  const gatedActions = actions.match(/return withAdmin\(/g) ?? [];
  assert.ok(exportedActions.length > 0);
  assert.equal(gatedActions.length, exportedActions.length);
  assert.match(actions, /getCurrentUser\(\)/);
  assert.match(actions, /getUserRole\(\)/);
  assert.match(actions, /isAdminRole\(role\)/);
});

test("rendered application code has no raw HTML execution sink", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("components")];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\s*\(/,
      file
    );
  }
});

test("runtime database access does not use unsafe raw-query APIs", () => {
  const files = [...sourceFiles("app"), ...sourceFiles("lib")].filter(
    (file) => !file.endsWith(".test.ts")
  );
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /\$queryRawUnsafe|\$executeRawUnsafe|\bsql`/, file);
  }
});
