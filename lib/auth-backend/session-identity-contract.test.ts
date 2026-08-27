import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAuthBackendName } from "./config.ts";
import { normalizeAuthenticatedUser } from "./normalize.ts";

const ROOT = new URL("../../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");

const USER_ID = "11111111-1111-4111-8111-111111111111";

test("authenticated-user normalization preserves UUID/email and rejects untrusted identity shapes", () => {
  assert.deepEqual(normalizeAuthenticatedUser({ id: USER_ID, email: "teacher@example.test" }), {
    id: USER_ID,
    email: "teacher@example.test",
  });
  assert.deepEqual(normalizeAuthenticatedUser({ id: USER_ID }), { id: USER_ID, email: null });
  assert.equal(normalizeAuthenticatedUser({ id: "not-a-uuid", email: "x@example.test" }), null);
  assert.equal(normalizeAuthenticatedUser({ id: USER_ID, email: 42 }), null);
  assert.equal(normalizeAuthenticatedUser(null), null);
});

test("auth backend remains environment-only and defaults to Supabase", () => {
  const previous = process.env.AUTH_BACKEND;
  try {
    delete process.env.AUTH_BACKEND;
    assert.equal(getAuthBackendName(), "supabase");
    process.env.AUTH_BACKEND = "better-auth";
    assert.equal(getAuthBackendName(), "better-auth");
  } finally {
    if (previous === undefined) delete process.env.AUTH_BACKEND;
    else process.env.AUTH_BACKEND = previous;
  }
});

test("Better Auth resolves only a validated database-backed server session", async () => {
  const [adapter, server, authIndex] = await Promise.all([
    source("lib/auth-backend/better-auth.ts"),
    source("lib/better-auth/server.ts"),
    source("lib/auth-backend/index.ts"),
  ]);
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /auth\.api\.getSession\(\{ headers: await headers\(\) \}\)/);
  assert.match(adapter, /normalizeAuthenticatedUser\(session\?\.user\)/);
  assert.match(server, /getSession\(input: \{ headers: Headers \}\)/);
  assert.match(authIndex, /getAuthBackendName\(\) === "better-auth"/);
  assert.doesNotMatch(adapter + authIndex, /request\.json|formData|searchParams/i);
});

test("protected database identity is backend-aware and Better Auth cannot fall through to Supabase Data API", async () => {
  const [identity, compatibility, postgres] = await Promise.all([
    source("lib/identity-read/index.ts"),
    source("lib/auth-backend/compatibility.ts"),
    source("lib/identity-read/postgres.ts"),
  ]);
  assert.match(identity, /const user = await getCurrentAuthUser\(\)/);
  assert.match(identity, /new PostgresIdentityReadRepository\(user\.id\)/);
  assert.match(identity, /requireSupabaseAuthForSupabaseDataApi\(databaseBackend\)/);
  assert.match(compatibility, /databaseBackend === "supabase" && getAuthBackendName\(\) === "better-auth"/);
  assert.match(postgres, /withAuthenticatedTransaction\(this\.userId/);
  assert.doesNotMatch(identity + compatibility, /service_role|withTrustedTransaction|bypassrls/i);
});

test("credential actions use the backend boundary while recovery and middleware remain Supabase-owned", async () => {
  const [actions, middleware, session, generation] = await Promise.all([
    source("app/actions/auth.ts"),
    source("lib/supabase/middleware.ts"),
    source("lib/auth/session.ts"),
    source("app/actions/exams.ts"),
  ]);
  assert.match(actions, /signupWithConfiguredBackend/);
  assert.match(actions, /loginWithConfiguredBackend/);
  assert.match(actions, /logoutWithConfiguredBackend/);
  assert.match(actions, /supabase\.auth\.resetPasswordForEmail/);
  assert.match(actions, /supabase\.auth\.updateUser/);
  assert.match(middleware, /supabase\.auth\.getUser\(\)/);
  assert.match(session, /getCurrentUser = getCurrentAuthUser/);
  assert.match(generation, /const user = await getCurrentUser\(\)/);
  assert.doesNotMatch(generation, /supabase\.auth\.getUser\(\)/);
});
