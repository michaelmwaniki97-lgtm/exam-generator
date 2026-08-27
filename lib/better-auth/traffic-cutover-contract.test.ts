import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");

test("Better Auth HTTP handler is mounted only when Better Auth is the configured authority", async () => {
  const [route, gate] = await Promise.all([
    source("app/api/auth/[...all]/route.ts"),
    source("lib/better-auth/http-gate.ts"),
  ]);

  assert.match(gate, /getAuthBackendName\(\) !== "better-auth"/);
  assert.match(gate, /return new Response\("Not Found", \{ status: 404 \}\)/);
  assert.match(route, /getBetterAuthFoundation\(\)/);
  assert.match(route, /handleConfiguredBetterAuthHttpRequest/);
  assert.match(route, /export const GET = handleBetterAuthRequest/);
  assert.match(route, /export const POST = handleBetterAuthRequest/);
  assert.doesNotMatch(route, /createClient|supabase\.auth|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_/i);
});

test("traffic cutover environment couples Better Auth to PostgreSQL, HTTPS production origin, and recovery SMTP", async () => {
  const readiness = await source("lib/better-auth/cutover-readiness.ts");

  assert.match(readiness, /AUTH_BACKEND=better-auth is required/);
  assert.match(readiness, /DATABASE_BACKEND=postgres is required/);
  assert.match(readiness, /DATABASE_URL is required/);
  assert.match(readiness, /BETTER_AUTH_SECRET must contain at least 32 characters/);
  assert.match(readiness, /BETTER_AUTH_URL must use HTTPS in production/);
  assert.match(readiness, /PUBLIC_APP_URL and BETTER_AUTH_URL must use the same origin/);
  assert.match(readiness, /getSmtpConfigForEnvironment\(environment\)/);
  assert.doesNotMatch(readiness, /NEXT_PUBLIC_BETTER_AUTH_SECRET|NEXT_PUBLIC_DATABASE_URL/);
});

test("traffic readiness proves identity anchors, legacy bridge retirement, and RLS helper permissions", async () => {
  const readiness = await source("lib/better-auth/cutover-readiness.ts");

  assert.match(readiness, /auth\.users a left join better_auth\.users b on b\.id = a\.id/);
  assert.match(readiness, /better_auth\.users b left join auth\.users a on a\.id = b\.id/);
  assert.match(readiness, /lower\(coalesce\(a\.email, ''\)\) <> lower\(b\.email\)/);
  assert.match(readiness, /source\.relname = 'teachers'[\s\S]*teachers_user_id_fkey[\s\S]*confdeltype = 'c'/);
  assert.match(readiness, /source\.relname = 'admins'[\s\S]*admins_user_id_fkey[\s\S]*confdeltype = 'c'/);
  assert.match(readiness, /source\.relname = 'textbook_documents'[\s\S]*textbook_documents_uploaded_by_fkey[\s\S]*confdeltype = 'r'/);
  assert.match(readiness, /tgname = 'on_auth_user_created'/);
  assert.match(readiness, /has_table_privilege\('service_role', 'auth\.users', 'SELECT'\)/);
  assert.match(readiness, /has_table_privilege\('service_role', 'auth\.users', 'INSERT'\)/);
  assert.match(readiness, /has_schema_privilege\('authenticated', 'auth', 'USAGE'\)/);
  assert.match(readiness, /has_function_privilege\('authenticated', 'auth\.uid\(\)', 'EXECUTE'\)/);
  assert.match(readiness, /readiness\.reviewedForeignKeys === 3/);
});

test("operator cutover check is read-only and reports counts without credentials or user data", async () => {
  const script = await source("scripts/check-better-auth-cutover.ts");

  assert.match(script, /readBetterAuthTrafficReadiness/);
  assert.match(script, /ready: isBetterAuthTrafficReady\(readiness\)/);
  assert.doesNotMatch(script, /insert\s+into|update\s+|delete\s+from|alter\s+table|drop\s+/i);
  assert.doesNotMatch(script, /email|password|encrypted_password|BETTER_AUTH_SECRET[^\n]*console|DATABASE_URL[^\n]*console/i);
});

test("Supabase remains the configuration-first rollback path during the acceptance window", async () => {
  const [config, index, supabase] = await Promise.all([
    source("lib/auth-backend/config.ts"),
    source("lib/auth-backend/index.ts"),
    source("lib/auth-backend/supabase.ts"),
  ]);

  assert.match(config, /if \(!configured \|\| configured === "supabase"\) return "supabase"/);
  assert.match(index, /getAuthBackendName\(\) === "better-auth"/);
  assert.match(index, /getSupabaseAuthenticatedUser/);
  assert.match(supabase, /supabase\.auth\.getUser\(\)/);
  assert.match(supabase, /supabase\.auth\.signInWithPassword/);
});
