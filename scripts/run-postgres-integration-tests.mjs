import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VECTOR_MIGRATION, assertSafeLocalDatabaseUrl } from "./migrate-local-postgres.mjs";
import {
  clearPostgresIntegrationIdentityFixtures,
  preparePostgresIntegrationDatabase,
  seedPostgresIntegrationFixtures,
} from "./seed-postgres-integration-fixtures.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const VECTOR_SCHEMA_TESTS = new Set([
  "lib/db/postgres-rpc.integration.test.ts",
  "lib/textbook-read/postgres-textbook-read.integration.test.ts",
  "lib/textbook-workflow/postgres-textbook-workflow.integration.test.ts",
]);
const FULL_CUTOVER_TESTS = new Set([
  "lib/better-auth/finalization.integration.test.ts",
  "lib/better-auth/identity-cutover.integration.test.ts",
  "lib/better-auth/rollback-window.integration.test.ts",
  "lib/better-auth/traffic-cutover.integration.test.ts",
]);

export function blockedIntegrationReason(file, blockedMigrations, failureOutput = "") {
  const normalized = file.replaceAll("\\", "/");
  if (!blockedMigrations.includes(VECTOR_MIGRATION)) return undefined;
  if (VECTOR_SCHEMA_TESTS.has(normalized)) {
    const knownVectorFailure = normalized === "lib/db/postgres-rpc.integration.test.ts"
      ? /function public\.list_ready_textbooks\(uuid, uuid\) does not exist/i.test(failureOutput)
      : normalized === "lib/textbook-read/postgres-textbook-read.integration.test.ts"
        ? /relation "public\.textbook_documents" does not exist/i.test(failureOutput)
        : /'error' !== 'created'/i.test(failureOutput);
    if (!knownVectorFailure) return undefined;
    return `${VECTOR_MIGRATION} is blocked because pgvector is unavailable`;
  }
  if (FULL_CUTOVER_TESTS.has(normalized)) {
    const knownCutoverFailure = normalized === "lib/better-auth/identity-cutover.integration.test.ts"
      ? /target_schema: 'auth'/i.test(failureOutput) && /textbook_documents_uploaded_by_fkey/i.test(failureOutput)
      : /relation "public\.textbook_documents" does not exist/i.test(failureOutput);
    if (!knownCutoverFailure) return undefined;
    return `${VECTOR_MIGRATION} and the reviewed one-way identity cutover state are prerequisites`;
  }
  return undefined;
}

export function discoverIntegrationTests(directory = join(ROOT, "lib")) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...discoverIntegrationTests(path));
    else if (entry.name.endsWith(".integration.test.ts")) files.push(relative(ROOT, path));
  }
  return files.sort();
}

export function assertDisposableIntegrationDatabase(value, environment = process.env) {
  const result = assertSafeLocalDatabaseUrl(value, environment);
  if (!result.database.endsWith("_test")) {
    throw new Error("PostgreSQL integrations require a dedicated *_test database.");
  }
  return result;
}

function metric(output, name) {
  const match = output.match(new RegExp(`(?:ℹ|#)\\s+${name}\\s+(\\d+)`));
  return match ? Number(match[1]) : 0;
}

export async function runPostgresIntegrationTests(environment = process.env) {
  const prepared = await preparePostgresIntegrationDatabase(environment);
  const testEnvironment = prepared.environment;
  const { database } = assertDisposableIntegrationDatabase(testEnvironment.DATABASE_URL, testEnvironment);
  const files = discoverIntegrationTests();
  const results = [];

  for (const file of files) {
    if (file.replaceAll("\\", "/").startsWith("lib/better-auth/")) {
      await clearPostgresIntegrationIdentityFixtures(testEnvironment);
    } else {
      await seedPostgresIntegrationFixtures(testEnvironment);
    }
    const result = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--test", "--experimental-strip-types", file],
      {
        cwd: ROOT,
        env: testEnvironment,
        encoding: "utf8",
        timeout: 120_000,
      },
    );
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    const blockedReason = result.status === 0
      ? undefined
      : blockedIntegrationReason(file, prepared.migration.blocked, output);
    const status = result.status === 0 ? "PASS" : blockedReason ? "BLOCKED" : "FAIL";
    results.push({
      file: file.replaceAll("\\", "/"),
      status,
      tests: metric(output, "tests"),
      passed: metric(output, "pass"),
      failed: status === "FAIL" ? metric(output, "fail") : 0,
      blocked: status === "BLOCKED" ? Math.max(metric(output, "fail"), 1) : 0,
      skipped: metric(output, "skipped"),
      output: status === "FAIL" ? output.trim() : undefined,
      blockedReason,
    });
    console.log(`${status} ${file}${blockedReason ? ` — ${blockedReason}` : ""}`);
    if (status === "FAIL" && output.trim()) console.log(output.trim());
  }

  const summary = {
    database,
    files: files.length,
    passedFiles: results.filter((result) => result.status === "PASS").length,
    failedFiles: results.filter((result) => result.status === "FAIL").length,
    blockedFiles: results.filter((result) => result.status === "BLOCKED").length,
    tests: results.reduce((sum, result) => sum + result.tests, 0),
    passed: results.reduce((sum, result) => sum + result.passed, 0),
    failed: results.reduce((sum, result) => sum + result.failed, 0),
    blocked: results.reduce((sum, result) => sum + result.blocked, 0),
    skipped: results.reduce((sum, result) => sum + result.skipped, 0),
    failedFileNames: results.filter((result) => result.status === "FAIL").map((result) => result.file),
    blockedFileNames: results.filter((result) => result.status === "BLOCKED").map((result) => result.file),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failedFiles) process.exitCode = 1;
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runPostgresIntegrationTests().catch((error) => {
    console.error(error instanceof Error ? error.message : "PostgreSQL integration setup failed.");
    process.exitCode = 1;
  });
}
