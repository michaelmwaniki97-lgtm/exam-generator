import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapDatabaseUrl, normalizeBootstrapEmail } from "./bootstrap-local-admin.mjs";

test("local admin bootstrap accepts a normalized existing-account email", () => {
  assert.equal(normalizeBootstrapEmail(" Admin@Example.test "), "admin@example.test");
});

test("local admin bootstrap rejects missing and malformed identifiers", () => {
  assert.throws(() => normalizeBootstrapEmail(""), /valid existing Better Auth email/);
  assert.throws(() => normalizeBootstrapEmail("not-an-email"), /valid existing Better Auth email/);
});

test("local admin bootstrap keeps runtime and operator connections on the same local database", () => {
  const selected = new URL(bootstrapDatabaseUrl({
    DATABASE_URL: "postgresql://runtime:secret@localhost/exam_generator",
    LOCAL_DATABASE_ADMIN_URL: "postgresql://owner:secret@localhost/exam_generator",
  }));
  assert.equal(selected.username, "owner");
  assert.throws(() => bootstrapDatabaseUrl({
    DATABASE_URL: "postgresql://runtime:secret@localhost/exam_generator",
    LOCAL_DATABASE_ADMIN_URL: "postgresql://owner:secret@localhost/other_test",
  }), /must target the same local database/);
});
