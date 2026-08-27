import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("source export keeps auth, public data, and storage as separate fail-closed artifacts", async () => {
  const script = await read("scripts/selfhosted/export-source.sh");
  assert.match(script, /--schema=public --data-only/);
  assert.match(script, /export-supabase-auth\.mjs/);
  assert.match(script, /export-textbooks\.mjs/);
  assert.match(script, /verify-textbook-export\.mjs/);
  assert.doesNotMatch(script, /service[_-]?role[^\n]*=/i);
});

test("auth export selects encrypted password material without logging identities or hashes", async () => {
  const script = await read("scripts/selfhosted/export-supabase-auth.mjs");
  assert.match(script, /encrypted_password/);
  assert.match(script, /raw_user_meta_data/);
  assert.match(script, /mode: 0o600/);
  assert.doesNotMatch(script, /console\.log\([^)]*email/);
  assert.doesNotMatch(script, /console\.log\([^)]*encrypted_password/);
});

test("public import is dry-run by default and requires preserved auth identities before destructive apply", async () => {
  const script = await read("scripts/selfhosted/import-public-data.sh");
  assert.match(script, /--apply/);
  assert.match(script, /select count\(\*\) from auth\.users/);
  assert.match(script, /TRUNCATE TABLE/);
  assert.match(script, /--single-transaction/);
  assert.match(script, /sha256sum -c/);
});

test("public reconciliation compares exact counts and deterministic SHA-256 fingerprints", async () => {
  const script = await read("scripts/selfhosted/reconcile-public-data.sh");
  assert.match(script, /source_count/);
  assert.match(script, /target_count/);
  assert.match(script, /to_jsonb\(t\)::text/);
  assert.match(script, /sha256sum/);
  assert.match(script, /status=FAIL/);
});

test("textbook migration validates database inventory plus byte size and SHA-256", async () => {
  const exporter = await read("scripts/selfhosted/export-textbooks.mjs");
  const importer = await read("scripts/selfhosted/import-textbooks.sh");
  assert.match(exporter, /storage\.objects/);
  assert.match(exporter, /textbook_documents/);
  assert.match(exporter, /content_sha256/);
  assert.match(exporter, /file_size/);
  assert.match(importer, /verify-textbook-export\.mjs/);
  assert.match(importer, /--apply/);
});

test("ops container receives runtime secrets by mounted file and has no public ports", async () => {
  const compose = await read("docker-compose.production.yml");
  const dockerfile = await read("Dockerfile.selfhosted");
  const opsBlock = compose.split("  ops:")[1]?.split("\n  app:")[0] || "";
  assert.match(opsBlock, /profiles: \["ops"\]/);
  assert.match(opsBlock, /runtime_env/);
  assert.match(opsBlock, /\/cutover/);
  assert.doesNotMatch(opsBlock, /ports:/);
  assert.match(dockerfile, /FROM base AS ops/);
  assert.match(dockerfile, /exam-generator-ops-entrypoint/);
});

test("runtime backups cover PostgreSQL and the private textbook volume and are restore-tested", async () => {
  const backup = await read("scripts/selfhosted/backup-runtime.sh");
  const verify = await read("scripts/selfhosted/verify-backup.sh");
  const restore = await read("scripts/selfhosted/restore-rehearsal.sh");
  assert.match(backup, /pg_dump/);
  assert.match(backup, /textbooks\.tar\.gz/);
  assert.match(backup, /SHA256SUMS/);
  assert.match(verify, /pg_restore -l/);
  assert.match(verify, /tar -tzf/);
  assert.match(restore, /schema-bootstrap/);
  assert.match(restore, /pg_restore/);
  assert.match(restore, /down -v/);
});
