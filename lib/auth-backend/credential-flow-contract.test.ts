import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAuthBackendName } from "./config.ts";

const ROOT = new URL("../../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");

test("credential mutations remain environment-only with Supabase as the default", async () => {
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

  const authIndex = await source("lib/auth-backend/index.ts");
  assert.match(authIndex, /signupWithConfiguredBackend[\s\S]*getAuthBackendName\(\) === "better-auth"/);
  assert.match(authIndex, /loginWithConfiguredBackend[\s\S]*getAuthBackendName\(\) === "better-auth"/);
  assert.match(authIndex, /logoutWithConfiguredBackend[\s\S]*getAuthBackendName\(\) === "better-auth"/);
  assert.doesNotMatch(authIndex, /formData|searchParams|request\.json/i);
});

test("Supabase credential adapter preserves signup metadata, confirmation, login, and logout semantics", async () => {
  const adapter = await source("lib/auth-backend/supabase.ts");
  assert.match(adapter, /supabase\.auth\.signUp\(\{/);
  assert.match(adapter, /data: \{ name: input\.name, school: input\.school, phone: input\.phone \}/);
  assert.match(adapter, /if \(!data\.session\) return \{ status: "confirmation-required" \}/);
  assert.match(adapter, /supabase\.auth\.signInWithPassword\(input\)/);
  assert.match(adapter, /supabase\.auth\.signOut\(\)/);
  assert.match(adapter, /sessionToken: null/);
});

test("Better Auth credential adapter uses validated server APIs and requires PostgreSQL", async () => {
  const [adapter, server, options] = await Promise.all([
    source("lib/auth-backend/better-auth.ts"),
    source("lib/better-auth/server.ts"),
    source("lib/better-auth/options.ts"),
  ]);
  assert.match(adapter, /getDatabaseBackendName\(\) !== "postgres"/);
  assert.match(adapter, /auth\.api\.signUpEmail\(\{/);
  assert.match(adapter, /auth\.api\.signInEmail\(\{/);
  assert.match(adapter, /auth\.api\.signOut\(\{ headers: await headers\(\) \}\)/);
  assert.match(adapter, /headers: await headers\(\)/);
  assert.match(server, /signUpEmail\(input:/);
  assert.match(server, /signInEmail\(input:/);
  assert.match(server, /signOut\(input:/);
  assert.match(options, /import \{ nextCookies \} from "better-auth\/next-js"/);
  assert.match(options, /plugins: \[nextCookies\(\)\]/);
  assert.doesNotMatch(adapter, /createAdminClient|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_/);
});

test("Better Auth signup preserves UUID through migration-aware application identity provisioning", async () => {
  const [adapter, bridge, sql, cutover] = await Promise.all([
    source("lib/auth-backend/better-auth.ts"),
    source("lib/better-auth/application-bridge.ts"),
    source("infra/self-hosted/auth/20-better-auth-application-bridge.sql"),
    source("infra/self-hosted/auth-cutover/40-better-auth-identity-cutover.sql"),
  ]);
  assert.match(adapter, /betterAuthEmailAlreadyExists\(input\.email\)/);
  assert.match(adapter, /betterAuthUserWasPersisted\(user\.id, input\.email\)/);
  assert.match(adapter, /return sessionToken[\s\S]*status: "confirmation-required"/);
  assert.match(adapter, /provisionBetterAuthApplicationIdentity\(\{[\s\S]*userId: user\.id/);
  assert.match(adapter, /betterAuthApplicationIdentityWasProvisioned\(user\.id, applicationEmail\)/);
  assert.match(adapter, /removeBetterAuthUserAfterFailedSignup\(userId\)/);
  assert.match(bridge, /insert into auth\.users \(id, email, raw_user_meta_data\)/);
  assert.match(bridge, /insert into public\.teachers \(user_id, name, school, phone\)/);
  assert.match(bridge, /profile\.userId/);
  assert.match(bridge, /JSON\.stringify\(\{ name: profile\.name, school: profile\.school, phone: profile\.phone \}\)/);
  assert.match(sql, /grant select, insert on table auth\.users to service_role/);
  assert.match(sql, /revoke update, delete on table auth\.users from service_role/);
  assert.doesNotMatch(bridge, /randomUUID|gen_random_uuid|crypto\.randomUUID/);
  assert.doesNotMatch(sql, /alter table public\.(teachers|admins|textbook_documents).*references better_auth\.users/is);
  assert.match(cutover, /references better_auth\.users\(id\)/);
  assert.match(cutover, /revoke select, insert on table auth\.users from service_role/);
});

test("failed/unknown-profile Better Auth login revokes only its just-created session token", async () => {
  const [actions, adapter, bridge] = await Promise.all([
    source("app/actions/auth.ts"),
    source("lib/auth-backend/better-auth.ts"),
    source("lib/better-auth/application-bridge.ts"),
  ]);
  assert.match(actions, /getUserRoleForAuthenticatedUser\(result\.user\)/);
  assert.match(actions, /if \(!role\)[\s\S]*logoutWithConfiguredBackend\(result\.sessionToken\)/);
  assert.match(adapter, /if \(sessionToken\)[\s\S]*removeBetterAuthSession\(sessionToken\)/);
  assert.match(bridge, /delete from better_auth\.sessions where token = \$1/);
  assert.doesNotMatch(bridge, /delete from better_auth\.sessions(?! where token)/);
});

test("password recovery stays backend-aware while retained Supabase proxy is accepted-state guarded", async () => {
  const [actions, callback, middleware, proxyAdapter, authIndex] = await Promise.all([
    source("app/actions/auth.ts"),
    source("app/auth/callback/route.ts"),
    source("lib/supabase/middleware.ts"),
    source("lib/auth-backend/proxy.ts"),
    source("lib/auth-backend/index.ts"),
  ]);
  assert.doesNotMatch(actions, /supabase\.auth\./);
  assert.match(actions, /requestPasswordResetWithConfiguredBackend/);
  assert.match(actions, /resetPasswordWithConfiguredBackend/);
  assert.match(authIndex, /requestPasswordResetWithConfiguredBackend[\s\S]*getAuthBackendName\(\) === "better-auth"/);
  assert.match(authIndex, /resetPasswordWithConfiguredBackend[\s\S]*getAuthBackendName\(\) === "better-auth"/);
  assert.match(callback, /getAuthBackendName\(\) === "better-auth"/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(middleware, /supabase\.auth\.getUser\(\)/);
  assert.match(middleware, /assertLegacySupabaseAuthAllowed\(\)/);
  assert.doesNotMatch(middleware, /getBetterAuth|better-auth\.ts/);
  assert.match(proxyAdapter, /getAuthBackendName\(\) === "better-auth"/);
  assert.match(proxyAdapter, /updateSupabaseSession\(request\)/);
});

test("credential forms never supply an authenticated UUID or authority", async () => {
  const actions = await source("app/actions/auth.ts");
  assert.doesNotMatch(actions, /formData\.get\(["'](?:userId|user_id|role|backend)["']\)/);
  assert.doesNotMatch(actions, /AUTH_BACKEND\s*=|DATABASE_BACKEND\s*=/);
});
