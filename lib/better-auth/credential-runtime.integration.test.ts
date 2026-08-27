import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const enabled = Boolean(url);

test("reviewed Better Auth options create and verify real credential users against PostgreSQL", { skip: !enabled }, async () => {
  const previous = {
    authBackend: process.env.AUTH_BACKEND,
    baseUrl: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
  };
  process.env.AUTH_BACKEND = "better-auth";
  process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET ||= "phase-3-disposable-integration-secret-000000000000";

  const email = `credential-runtime-${randomUUID()}@example.test`;
  const password = "synthetic-phase3-password";
  const pool = new Pool({ connectionString: url!, options: "-c search_path=better_auth,public" });
  let userId: string | undefined;
  try {
    const runtimeGrants = (await pool.query<{ schema_usage: boolean; users_crud: boolean }>(
      `select
         has_schema_privilege('exam_app_runtime', 'better_auth', 'USAGE') as schema_usage,
         (has_table_privilege('exam_app_runtime', 'better_auth.users', 'SELECT')
          and has_table_privilege('exam_app_runtime', 'better_auth.users', 'INSERT')
          and has_table_privilege('exam_app_runtime', 'better_auth.users', 'UPDATE')
          and has_table_privilege('exam_app_runtime', 'better_auth.users', 'DELETE')) as users_crud`,
    )).rows[0];
    assert.deepEqual(runtimeGrants, { schema_usage: true, users_crud: true });

    const [{ betterAuth }, { buildBetterAuthOptions }] = await Promise.all([
      import("better-auth"),
      import("./options.ts"),
    ]);

    // nextCookies is a Next.js Server Action response adapter. Remove only that
    // plugin in this raw Node integration test; the production build separately
    // validates that the real application options include it.
    const options = buildBetterAuthOptions();
    const auth = betterAuth({ ...options, plugins: [] });

    const signup = await auth.api.signUpEmail({
      body: { name: "Credential Runtime Teacher", email, password },
    });
    assert.ok(signup.user?.id);
    userId = signup.user.id;
    assert.match(userId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(signup.user.email, email);
    assert.ok(signup.token);

    const account = (await pool.query<{ issuer: string; account_id: string; provider_id: string; password: string | null }>(
      "select issuer, account_id, provider_id, password from better_auth.accounts where user_id = $1::uuid",
      [userId],
    )).rows[0];
    assert.equal(account?.issuer, "local:credential");
    assert.equal(account?.account_id, userId);
    assert.equal(account?.provider_id, "credential");
    assert.ok(account?.password);

    const login = await auth.api.signInEmail({ body: { email, password } });
    assert.equal(login.user.id, userId);
    assert.ok(login.token);
  } finally {
    if (userId) {
      try { await pool.query("delete from better_auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    }
    await pool.end();
    try {
      const { closeBetterAuthPool } = await import("./pool.ts");
      await closeBetterAuthPool();
    } catch { /* no pool may have been created */ }

    if (previous.authBackend === undefined) delete process.env.AUTH_BACKEND;
    else process.env.AUTH_BACKEND = previous.authBackend;
    if (previous.baseUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = previous.baseUrl;
    if (previous.secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous.secret;
  }
});
