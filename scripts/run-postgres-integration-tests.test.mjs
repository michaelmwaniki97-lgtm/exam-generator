import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDisposableIntegrationDatabase,
  blockedIntegrationReason,
  discoverIntegrationTests,
} from "./run-postgres-integration-tests.mjs";
import { VECTOR_MIGRATION } from "./migrate-local-postgres.mjs";
import { integrationDatabaseEnvironment } from "./seed-postgres-integration-fixtures.mjs";

test("PostgreSQL integration runner discovers the complete current suite", () => {
  const files = discoverIntegrationTests();
  assert.equal(files.length, 27);
  assert.ok(files.every((file) => file.endsWith(".integration.test.ts")));
});

test("PostgreSQL integration runner refuses the local development database", () => {
  assert.equal(
    assertDisposableIntegrationDatabase("postgresql://user:secret@localhost/exam_generator_test", {}).database,
    "exam_generator_test",
  );
  assert.throws(
    () => assertDisposableIntegrationDatabase("postgresql://user:secret@localhost/exam_generator", {}),
    /dedicated \*_test database/,
  );
});

test("PostgreSQL integration setup derives a disposable test database without mutating the development URL", () => {
  const environment = integrationDatabaseEnvironment({
    DATABASE_URL: "postgresql://runtime:secret@localhost/exam_generator",
    LOCAL_DATABASE_ADMIN_URL: "postgresql://owner:secret@localhost/exam_generator",
  });
  assert.equal(new URL(environment.DATABASE_URL).pathname, "/exam_generator_test");
  assert.equal(new URL(environment.LOCAL_DATABASE_ADMIN_URL).pathname, "/exam_generator_test");
  assert.equal(new URL(environment.DATABASE_URL).username, "runtime");
  assert.equal(new URL(environment.LOCAL_DATABASE_ADMIN_URL).username, "owner");
});

test("PostgreSQL integration reporting isolates only reviewed pgvector/cutover prerequisites", () => {
  assert.match(
    blockedIntegrationReason(
      "lib/textbook-read/postgres-textbook-read.integration.test.ts",
      [VECTOR_MIGRATION],
      'relation "public.textbook_documents" does not exist',
    ) ?? "",
    /pgvector is unavailable/,
  );
  assert.match(
    blockedIntegrationReason(
      "lib/better-auth/identity-cutover.integration.test.ts",
      [VECTOR_MIGRATION],
      "target_schema: 'auth'; missing textbook_documents_uploaded_by_fkey",
    ) ?? "",
    /one-way identity cutover/,
  );
  assert.equal(
    blockedIntegrationReason("lib/catalog/postgres-catalog.integration.test.ts", [VECTOR_MIGRATION]),
    undefined,
  );
  assert.equal(
    blockedIntegrationReason("lib/textbook-read/postgres-textbook-read.integration.test.ts", [], "unavailable"),
    undefined,
  );
  assert.equal(
    blockedIntegrationReason("lib/textbook-read/postgres-textbook-read.integration.test.ts", [VECTOR_MIGRATION], "syntax error"),
    undefined,
  );
});
