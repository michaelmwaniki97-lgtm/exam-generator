import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const operatorUrl = process.env.LOCAL_DATABASE_ADMIN_URL ?? url;
const enabled = Boolean(url);

function sessionCookieFrom(response: Response): string {
  const headersWithCookieList = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headersWithCookieList.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const sessionCookie = setCookies.find((value) => /session_token=/.test(value));
  assert.ok(sessionCookie, "Better Auth sign-in response must set a session token cookie");
  return sessionCookie.split(";", 1)[0];
}

test("cutover freeze preserves login/RLS/sign-out while blocking rollback-breaking auth mutations", { skip: !enabled }, async () => {
  const previous = {
    authBackend: process.env.AUTH_BACKEND,
    databaseBackend: process.env.DATABASE_BACKEND,
    mutationMode: process.env.AUTH_MUTATION_MODE,
    cutoverState: process.env.AUTH_CUTOVER_STATE,
    baseUrl: process.env.BETTER_AUTH_URL,
    publicAppUrl: process.env.PUBLIC_APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    smtpUrl: process.env.SMTP_URL,
    emailFrom: process.env.AUTH_EMAIL_FROM,
  };

  process.env.AUTH_BACKEND = "better-auth";
  process.env.DATABASE_BACKEND = "postgres";
  process.env.AUTH_MUTATION_MODE = "normal";
  process.env.AUTH_CUTOVER_STATE = "compatibility";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.PUBLIC_APP_URL = "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET = "phase-9-disposable-rollback-window-secret-000000000000000";
  process.env.SMTP_URL = "smtp://localhost:2525";
  process.env.AUTH_EMAIL_FROM = "Exam Generator <no-reply@example.test>";

  const pool = new Pool({ connectionString: operatorUrl! });
  const email = `rollback-window-${randomUUID()}@example.test`;
  const blockedEmail = `blocked-signup-${randomUUID()}@example.test`;
  const password = "synthetic-phase9-password";
  let userId: string | undefined;

  try {
    const [{ betterAuth }, { buildBetterAuthOptions }, { provisionBetterAuthApplicationIdentity }] = await Promise.all([
      import("better-auth"),
      import("./options.ts"),
      import("./application-bridge.ts"),
    ]);
    const auth = betterAuth({ ...buildBetterAuthOptions(), plugins: [] });

    // Seed one rollback-compatible account before the freeze. In compatibility
    // mode the application bridge owns the retained auth.users mirror.
    const signup = await auth.api.signUpEmail({ body: { name: "Rollback Window Teacher", email, password } });
    assert.ok(signup.user?.id);
    userId = signup.user.id;
    await provisionBetterAuthApplicationIdentity({
      userId,
      email,
      name: "Rollback Window Teacher",
      school: "Rollback Window School",
      phone: "+254700000009",
    });

    process.env.AUTH_MUTATION_MODE = "cutover-freeze";
    process.env.AUTH_CUTOVER_STATE = "rollback-window";

    const [
      { assertAuthRollbackWindowFrozen },
      { assertBetterAuthTrafficEnvironment, isBetterAuthTrafficReady, readBetterAuthTrafficReadiness },
      { handleConfiguredBetterAuthHttpRequest },
    ] = await Promise.all([
      import("../auth-backend/cutover-mode.ts"),
      import("./cutover-readiness.ts"),
      import("./http-gate.ts"),
    ]);

    assertAuthRollbackWindowFrozen(process.env);
    assertBetterAuthTrafficEnvironment(process.env);
    assert.equal(isBetterAuthTrafficReady(await readBetterAuthTrafficReadiness(pool)), true);

    let handlerInitializations = 0;
    const gate = (request: Request) => handleConfiguredBetterAuthHttpRequest(request, async () => {
      handlerInitializations += 1;
      return auth.handler;
    });

    const blockedSignup = await gate(new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Blocked", email: blockedEmail, password }),
    }));
    assert.equal(blockedSignup.status, 503);
    assert.equal(blockedSignup.headers.get("retry-after"), "60");
    assert.equal(handlerInitializations, 0, "frozen mutations must not initialize Better Auth");
    assert.equal(Number((await pool.query("select count(*)::int as count from better_auth.users where lower(email)=lower($1)", [blockedEmail])).rows[0]?.count ?? -1), 0);

    const blockedRecovery = await gate(new Request("http://localhost:3000/api/auth/request-password-reset", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email }),
    }));
    assert.equal(blockedRecovery.status, 503);
    assert.equal(handlerInitializations, 0);

    const signInResponse = await gate(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password, rememberMe: true }),
    }));
    assert.equal(signInResponse.status, 200);
    const cookie = sessionCookieFrom(signInResponse);
    assert.equal(handlerInitializations, 1);

    const getSession = () => gate(new Request("http://localhost:3000/api/auth/get-session", {
      method: "GET",
      headers: { cookie },
    }));
    const sessionResponse = await getSession();
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json() as { user?: { id?: string; email?: string } } | null;
    assert.equal(session?.user?.id, userId);
    assert.equal(session?.user?.email, email);

    const { PostgresIdentityReadRepository } = await import("../identity-read/postgres.ts");
    assert.equal(await new PostgresIdentityReadRepository(userId).resolveRole(), "teacher");

    const signOutResponse = await gate(new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:3000" },
      body: "{}",
    }));
    assert.equal(signOutResponse.status, 200);
    assert.equal(await (await getSession()).json(), null);

    // Configuration-first rollback makes the Better Auth HTTP surface inert
    // again while the freeze prevents any new identity drift during the window.
    process.env.AUTH_BACKEND = "supabase";
    let rollbackHandlerInitialized = false;
    const rollbackResponse = await handleConfiguredBetterAuthHttpRequest(
      new Request("http://localhost:3000/api/auth/sign-in/email", { method: "POST" }),
      async () => { rollbackHandlerInitialized = true; return auth.handler; },
    );
    assert.equal(rollbackResponse.status, 404);
    assert.equal(rollbackHandlerInitialized, false);
  } finally {
    process.env.AUTH_BACKEND = "better-auth";
    if (userId) {
      try { await pool.query("delete from better_auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
      try { await pool.query("delete from auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    }
    await pool.end();
    try {
      const { closeBetterAuthPool } = await import("./pool.ts");
      await closeBetterAuthPool();
    } catch { /* no pool may have been created */ }
    try {
      const { closePostgresPool } = await import("../db/postgres-client.ts");
      await closePostgresPool();
    } catch { /* no pool may have been created */ }

    const restore = (name: keyof typeof previous, envName: string) => {
      const value = previous[name];
      if (value === undefined) delete process.env[envName];
      else process.env[envName] = value;
    };
    restore("authBackend", "AUTH_BACKEND");
    restore("databaseBackend", "DATABASE_BACKEND");
    restore("mutationMode", "AUTH_MUTATION_MODE");
    restore("cutoverState", "AUTH_CUTOVER_STATE");
    restore("baseUrl", "BETTER_AUTH_URL");
    restore("publicAppUrl", "PUBLIC_APP_URL");
    restore("secret", "BETTER_AUTH_SECRET");
    restore("smtpUrl", "SMTP_URL");
    restore("emailFrom", "AUTH_EMAIL_FROM");
  }
});
