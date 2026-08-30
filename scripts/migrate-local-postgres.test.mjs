import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  VECTOR_MIGRATION,
  assertSafeLocalDatabaseUrl,
  migrationFiles,
  stripSupportedPsqlMetaCommands,
} from "./migrate-local-postgres.mjs";

test("local migration URL guard permits only explicit loopback development databases", () => {
  assert.equal(
    assertSafeLocalDatabaseUrl("postgresql://user:secret@localhost:5432/exam_generator", {}).database,
    "exam_generator",
  );
  assert.equal(
    assertSafeLocalDatabaseUrl("postgresql://user:secret@127.0.0.1/example_test", {}).database,
    "example_test",
  );
  assert.throws(
    () => assertSafeLocalDatabaseUrl("postgresql://user:secret@db.example.com/exam_generator", {}),
    /non-loopback/,
  );
  assert.throws(
    () => assertSafeLocalDatabaseUrl("postgresql://user:secret@localhost/customer_data", {}),
    /permits only/,
  );
  assert.throws(
    () => assertSafeLocalDatabaseUrl("postgresql://user:secret@localhost/exam_generator", { NODE_ENV: "production" }),
    /refuses NODE_ENV=production/,
  );
});

test("migration source accepts only the reviewed ON_ERROR_STOP psql directive", () => {
  assert.equal(stripSupportedPsqlMetaCommands("\\set ON_ERROR_STOP on\nselect 1;\n", "safe.sql"), "select 1;\n");
  assert.throws(
    () => stripSupportedPsqlMetaCommands("\\i unexpected.sql\n", "unsafe.sql"),
    /Unsupported psql meta-command/,
  );
});

test("repository migration plan keeps the vector migration explicit and ordered", () => {
  const files = migrationFiles(fileURLToPath(new URL("../supabase/migrations", import.meta.url)));
  assert.equal(files.length, 27);
  assert.ok(files.some((file) => file.name === VECTOR_MIGRATION));
  assert.deepEqual(files.map((file) => file.name), files.map((file) => file.name).toSorted());
});
