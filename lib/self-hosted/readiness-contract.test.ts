import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { auditSelfHostedDependencies, isSelfHostedDependencyReady } from "./dependency-audit.ts";
import { assertSelfHostedRuntimeEnvironment } from "./readiness.ts";

const root = process.cwd();

function acceptedEnvironment(extra: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    DATABASE_BACKEND: "postgres",
    DATABASE_URL: "postgresql://exam_app_runtime:secret@database:5432/exam_generator",
    AUTH_BACKEND: "better-auth",
    AUTH_CUTOVER_STATE: "accepted",
    AUTH_MUTATION_MODE: "normal",
    BETTER_AUTH_URL: "https://exams.example.test",
    BETTER_AUTH_SECRET: "x".repeat(48),
    PUBLIC_APP_URL: "https://exams.example.test",
    SMTP_URL: "smtps://mailer:secret@smtp.example.test:465",
    AUTH_EMAIL_FROM: "Exam Generator <no-reply@example.test>",
    TEXTBOOK_STORAGE_BACKEND: "filesystem",
    TEXTBOOK_STORAGE_ROOT: "/srv/exam-generator/textbooks",
    AI_PROVIDER: "nvidia",
    NVIDIA_API_KEY: "synthetic-key",
    PAYMENT_PROVIDER: "daraja",
    MPESA_ENVIRONMENT: "sandbox",
    MPESA_CONSUMER_KEY: "synthetic-consumer-key",
    MPESA_CONSUMER_SECRET: "synthetic-consumer-secret",
    MPESA_BUSINESS_SHORTCODE: "174379",
    MPESA_PARTY_B: "174379",
    MPESA_PASSKEY: "synthetic-passkey",
    MPESA_TRANSACTION_TYPE: "CustomerPayBillOnline",
    ...extra,
  };
}

test("accepted self-hosted runtime requires PostgreSQL, Better Auth, filesystem storage, AI, SMTP, and Daraja", () => {
  const readiness = assertSelfHostedRuntimeEnvironment(acceptedEnvironment());
  assert.equal(readiness.databaseBackend, "postgres");
  assert.equal(readiness.authBackend, "better-auth");
  assert.equal(readiness.authCutoverState, "accepted");
  assert.equal(readiness.storageBackend, "filesystem");
  assert.equal(readiness.aiProvider, "nvidia");
  assert.equal(readiness.paymentProvider, "daraja");
  assert.equal(readiness.legacySupabaseSecretsPresent, false);

  assert.throws(() => assertSelfHostedRuntimeEnvironment(acceptedEnvironment({ DATABASE_BACKEND: "supabase" })), /DATABASE_BACKEND/);
  assert.throws(() => assertSelfHostedRuntimeEnvironment(acceptedEnvironment({ AUTH_BACKEND: "supabase" })), /AUTH_BACKEND/);
  assert.throws(() => assertSelfHostedRuntimeEnvironment(acceptedEnvironment({ AUTH_CUTOVER_STATE: "rollback-window" })), /AUTH_CUTOVER_STATE/);
  assert.throws(() => assertSelfHostedRuntimeEnvironment(acceptedEnvironment({ TEXTBOOK_STORAGE_BACKEND: "supabase" })), /TEXTBOOK_STORAGE_BACKEND/);
  assert.throws(() => assertSelfHostedRuntimeEnvironment(acceptedEnvironment({ TEXTBOOK_STORAGE_ROOT: "relative/path" })), /TEXTBOOK_STORAGE_ROOT/);
  assert.throws(() => assertSelfHostedRuntimeEnvironment(acceptedEnvironment({ PUBLIC_APP_URL: "http://exams.example.test", BETTER_AUTH_URL: "http://exams.example.test" })), /HTTPS/);
  assert.throws(() => assertSelfHostedRuntimeEnvironment(acceptedEnvironment({ AI_PROVIDER: "nvidia", NVIDIA_API_KEY: "" })), /NVIDIA_API_KEY/);
  assert.throws(() => assertSelfHostedRuntimeEnvironment(acceptedEnvironment({ PAYMENT_PROVIDER: "fake" })), /PAYMENT_PROVIDER/);
});

test("runtime source has no direct Supabase application/data/auth/storage bypasses", async () => {
  const audit = await auditSelfHostedDependencies(root);
  assert.equal(isSelfHostedDependencyReady(audit), true);
  assert.deepEqual(audit.directAppSupabaseImports, []);
  assert.deepEqual(audit.directRuntimeDataCalls, []);
  assert.deepEqual(audit.directRuntimeStorageCalls, []);
  assert.deepEqual(audit.directRuntimeAuthCalls, []);
  assert.deepEqual(audit.maintenanceSupabaseScripts, [
    "scripts/audit-live-curriculum.mjs",
    "scripts/import-verified-curriculum.mjs",
  ]);
  assert.equal(audit.fallbackAdapterFiles.length, 18);
});

test("admin actions no longer initialize Supabase on the PostgreSQL path and payment repository is transport-neutral", async () => {
  const admin = await readFile(path.join(root, "app/actions/admin.ts"), "utf8");
  assert.doesNotMatch(admin, /supabase\/server|createClient\(/);
  assert.match(admin, /type Operation = \(\) => Promise<AdminActionState>/);
  assert.match(admin, /return await operation\(\)/);

  const payments = await readFile(path.join(root, "lib/payments/server.ts"), "utf8");
  assert.match(payments, /export class ServerPaymentRepository implements PaymentRepository/);
  assert.doesNotMatch(payments, /class SupabasePaymentRepository/);
  for (const file of ["app/actions/payments.ts", "app/api/payments/mpesa/callback/route.ts"]) {
    const source = await readFile(path.join(root, file), "utf8");
    assert.match(source, /ServerPaymentRepository/);
    assert.doesNotMatch(source, /SupabasePaymentRepository/);
  }
});

test("parity compose exposes its loopback test port through a non-internal host-access network", async () => {
  const compose = await readFile(path.join(root, "docker-compose.selfhosted.yml"), "utf8");
  assert.match(compose, /127\.0\.0\.1:\$\{SELFHOSTED_DB_PORT:-55432\}:5432/);
  assert.match(compose, /- selfhosted_private\n\s+- selfhosted_host_access/);
  assert.match(compose, /selfhosted_private:[\s\S]*internal: true/);
  assert.match(compose, /selfhosted_host_access:\n\s+name: exam-generator-selfhosted-parity-host-access/);
});

test("environment example documents every accepted self-hosted service boundary without secrets", async () => {
  const env = await readFile(path.join(root, ".env.example"), "utf8");
  for (const name of [
    "DATABASE_BACKEND", "DATABASE_URL", "AUTH_BACKEND", "AUTH_CUTOVER_STATE", "AUTH_MUTATION_MODE",
    "BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "PUBLIC_APP_URL", "SMTP_URL", "AUTH_EMAIL_FROM",
    "TEXTBOOK_STORAGE_BACKEND", "TEXTBOOK_STORAGE_ROOT", "AI_PROVIDER", "NVIDIA_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY",
    "PAYMENT_PROVIDER", "MPESA_ENVIRONMENT", "MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_BUSINESS_SHORTCODE",
    "MPESA_PARTY_B", "MPESA_PASSKEY", "MPESA_TRANSACTION_TYPE", "MPESA_QUERY_URL",
  ]) assert.match(env, new RegExp(`^${name}=`, "m"), name);
  assert.match(env, /Legacy Supabase rollback\/fallback credentials/);
});
