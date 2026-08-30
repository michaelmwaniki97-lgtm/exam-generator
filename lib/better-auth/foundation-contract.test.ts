import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAuthBackendName } from "../auth-backend/config.ts";
import { isSupabaseBcryptHash, verifyImportedSupabasePassword } from "./password-migration.ts";

const ROOT = new URL("../../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("AUTH_BACKEND is self-hosted by default in development and explicit in production", () => {
  assert.equal(getAuthBackendName({ NODE_ENV: "development" }), "better-auth");
  assert.equal(getAuthBackendName({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }), "better-auth");
  assert.throws(
    () => getAuthBackendName({ NODE_ENV: "production" }),
    /AUTH_BACKEND is required in production/,
  );
  assert.equal(getAuthBackendName({ NODE_ENV: "production", AUTH_BACKEND: "better-auth" }), "better-auth");
  assert.equal(getAuthBackendName({ NODE_ENV: "production", AUTH_BACKEND: "supabase" }), "supabase");
  assert.equal(getAuthBackendName({ NODE_ENV: "test" }), "supabase");
  assert.throws(() => getAuthBackendName({ AUTH_BACKEND: "browser" }), /supabase or better-auth/);
});

test("Better Auth runtime stays isolated from the explicit legacy path while Proxy dispatches by backend", async () => {
  const [server, session, actions, middleware, proxyAdapter] = await Promise.all([
    source("lib/better-auth/server.ts"),
    source("lib/auth/session.ts"),
    source("app/actions/auth.ts"),
    source("lib/supabase/middleware.ts"),
    source("lib/auth-backend/proxy.ts"),
  ]);
  assert.match(server, /getAuthBackendName\(\) !== "better-auth"/);
  assert.match(server, /buildBetterAuthOptions/);
  assert.match(session, /getCurrentUser = getCurrentAuthUser/);
  assert.match(actions, /signupWithConfiguredBackend/);
  assert.match(actions, /loginWithConfiguredBackend/);
  assert.match(actions, /logoutWithConfiguredBackend/);
  assert.match(actions, /requestPasswordResetWithConfiguredBackend/);
  assert.match(actions, /resetPasswordWithConfiguredBackend/);
  assert.doesNotMatch(actions, /supabase\.auth\./);
  assert.match(middleware, /supabase\.auth\.getUser\(\)/);
  assert.match(proxyAdapter, /getAuthBackendName\(\) === "better-auth"/);
  assert.match(proxyAdapter, /updateSupabaseSession\(request\)/);
});

test("Better Auth config uses PostgreSQL, UUIDs, database sessions, and snake-case mappings", async () => {
  const [options, pool] = await Promise.all([
    source("lib/better-auth/options.ts"),
    source("lib/better-auth/pool.ts"),
  ]);
  assert.match(options, /database: getBetterAuthPool\(\)/);
  assert.match(options, /emailAndPassword:[\s\S]*enabled: true/);
  assert.match(options, /plugins: \[nextCookies\(\)\]/);
  assert.match(options, /generateId: "uuid"/);
  assert.match(options, /modelName: "users"/);
  assert.match(options, /modelName: "sessions"/);
  assert.match(options, /modelName: "accounts"/);
  assert.match(options, /modelName: "verifications"/);
  assert.match(pool, /search_path=better_auth,public/);
  assert.doesNotMatch(options + pool, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient|service_role/);
});

test("foundation SQL keeps Better Auth isolated and preserves explicit UUID import", async () => {
  const sql = await source("infra/self-hosted/auth/10-better-auth-foundation.sql");
  for (const table of ["users", "sessions", "accounts", "verifications"]) {
    assert.match(sql, new RegExp(`better_auth\\.${table}`));
  }
  assert.match(sql, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(sql, /better_auth\.sessions[\s\S]*references better_auth\.users\(id\) on delete cascade/);
  assert.match(sql, /better_auth\.accounts[\s\S]*unique \(issuer, account_id\)/);
  assert.doesNotMatch(sql, /alter table public\.(teachers|admins|textbook_documents)/i);
  assert.doesNotMatch(sql, /references better_auth\.users[\s\S]*public\.(teachers|admins|textbook_documents)/i);
});

test("Supabase bcrypt hashes are recognized and delegated without implementing crypto incorrectly", async () => {
  const bcryptHash = "$2b$10$" + "A".repeat(53);
  assert.equal(isSupabaseBcryptHash(bcryptHash), true);
  assert.equal(isSupabaseBcryptHash("scrypt:not-bcrypt"), false);
  let seen: [string, string] | undefined;
  const result = await verifyImportedSupabasePassword("secret", bcryptHash, async (password, hash) => {
    seen = [password, hash];
    return true;
  });
  assert.equal(result, true);
  assert.deepEqual(seen, ["secret", bcryptHash]);
});
