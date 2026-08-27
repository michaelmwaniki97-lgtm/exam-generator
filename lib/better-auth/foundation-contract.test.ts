import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAuthBackendName } from "../auth-backend/config.ts";
import { isSupabaseBcryptHash, verifyImportedSupabasePassword } from "./password-migration.ts";

const ROOT = new URL("../../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, ROOT), "utf8");
}

test("AUTH_BACKEND defaults to Supabase and accepts only the reviewed values", () => {
  const previous = process.env.AUTH_BACKEND;
  try {
    delete process.env.AUTH_BACKEND;
    assert.equal(getAuthBackendName(), "supabase");
    process.env.AUTH_BACKEND = "supabase";
    assert.equal(getAuthBackendName(), "supabase");
    process.env.AUTH_BACKEND = "better-auth";
    assert.equal(getAuthBackendName(), "better-auth");
    process.env.AUTH_BACKEND = "browser";
    assert.throws(() => getAuthBackendName(), /supabase or better-auth/);
  } finally {
    if (previous === undefined) delete process.env.AUTH_BACKEND;
    else process.env.AUTH_BACKEND = previous;
  }
});

test("Better Auth credential mutations are opt-in while recovery and middleware remain Supabase-owned", async () => {
  const [server, session, actions, middleware] = await Promise.all([
    source("lib/better-auth/server.ts"),
    source("lib/auth/session.ts"),
    source("app/actions/auth.ts"),
    source("lib/supabase/middleware.ts"),
  ]);
  assert.match(server, /getAuthBackendName\(\) !== "better-auth"/);
  assert.match(server, /buildBetterAuthOptions/);
  assert.match(session, /getCurrentUser = getCurrentAuthUser/);
  assert.match(actions, /signupWithConfiguredBackend/);
  assert.match(actions, /loginWithConfiguredBackend/);
  assert.match(actions, /logoutWithConfiguredBackend/);
  assert.match(actions, /supabase\.auth\.resetPasswordForEmail/);
  assert.match(middleware, /supabase\.auth\.getUser\(\)/);
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
