import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const enabled = Boolean(url);

function sessionCookieFrom(response: Response): string {
  const headersWithCookieList = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headersWithCookieList.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const sessionCookie = setCookies.find((value) => /session_token=/.test(value));
  assert.ok(sessionCookie, "Better Auth sign-in response must set a session token cookie");
  return sessionCookie.split(";", 1)[0];
}

test("accepted Better Auth state provisions canonical identity, keeps app-owned mutations gated, and rejects Supabase rollback", { skip: !enabled }, async () => {
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
  process.env.AUTH_CUTOVER_STATE = "accepted";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.PUBLIC_APP_URL = "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET = "phase-10-disposable-accepted-secret-000000000000000000";
  process.env.SMTP_URL = "smtp://localhost:2525";
  process.env.AUTH_EMAIL_FROM = "Exam Generator <no-reply@example.test>";

  const pool = new Pool({ connectionString: url! });
  const email = `accepted-${randomUUID()}@example.test`;
  const blockedEmail = `direct-http-blocked-${randomUUID()}@example.test`;
  const password = "synthetic-phase10-password";
  let userId: string | undefined;

  try {
    const [
      { betterAuth },
      { buildBetterAuthOptions },
      { provisionBetterAuthApplicationIdentity },
      { assertAuthCutoverConfiguration, assertLegacySupabaseAuthAllowed },
      { assertBetterAuthTrafficEnvironment, isBetterAuthAcceptedReady, readBetterAuthTrafficReadiness },
      { handleConfiguredBetterAuthHttpRequest },
    ] = await Promise.all([
      import("better-auth"),
      import("./options.ts"),
      import("./application-bridge.ts"),
      import("../auth-backend/cutover-state.ts"),
      import("./cutover-readiness.ts"),
      import("./http-gate.ts"),
    ]);

    assertAuthCutoverConfiguration(process.env);
    assertBetterAuthTrafficEnvironment(process.env);
    const before = await readBetterAuthTrafficReadiness(pool);
    assert.equal(isBetterAuthAcceptedReady(before), true);

    const auth = betterAuth({ ...buildBetterAuthOptions(), plugins: [] });
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
    assert.equal(blockedSignup.status, 404);
    assert.equal(handlerInitializations, 0, "app-owned HTTP mutations must not initialize Better Auth");

    // Simulate the reviewed application signup path: Better Auth credential
    // creation followed by trusted application-identity provisioning.
    const signup = await auth.api.signUpEmail({ body: { name: "Accepted Teacher", email, password } });
    assert.ok(signup.user?.id);
    userId = signup.user.id;
    await provisionBetterAuthApplicationIdentity({
      userId,
      email,
      name: "Accepted Teacher",
      school: "Accepted School",
      phone: "+254700000010",
    });

    assert.equal(Number((await pool.query("select count(*)::int as count from auth.users where id = $1::uuid", [userId])).rows[0]?.count ?? -1), 0);
    assert.equal(Number((await pool.query("select count(*)::int as count from public.teachers where user_id = $1::uuid", [userId])).rows[0]?.count ?? -1), 1);

    const afterSignup = await readBetterAuthTrafficReadiness(pool);
    assert.ok(afterSignup.betterAuthUsersMissingHistorical >= 1, "accepted users intentionally need no auth.users mirror");
    assert.equal(isBetterAuthAcceptedReady(afterSignup), true);

    const signInResponse = await gate(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password, rememberMe: true }),
    }));
    assert.equal(signInResponse.status, 200);
    const cookie = sessionCookieFrom(signInResponse);

    const getSession = () => gate(new Request("http://localhost:3000/api/auth/get-session", {
      method: "GET",
      headers: { cookie },
    }));
    const session = await (await getSession()).json() as { user?: { id?: string } } | null;
    assert.equal(session?.user?.id, userId);

    const { PostgresIdentityReadRepository } = await import("../identity-read/postgres.ts");
    assert.equal(await new PostgresIdentityReadRepository(userId).resolveRole(), "teacher");

    const signOutResponse = await gate(new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: "http://localhost:3000" },
      body: "{}",
    }));
    assert.equal(signOutResponse.status, 200);
    assert.equal(await (await getSession()).json(), null);

    assert.throws(() => assertLegacySupabaseAuthAllowed(process.env), /Supabase Auth is retired/);
    process.env.AUTH_BACKEND = "supabase";
    assert.throws(() => assertAuthCutoverConfiguration(process.env), /AUTH_BACKEND=better-auth/);
  } finally {
    process.env.AUTH_BACKEND = "better-auth";
    if (userId) {
      try { await pool.query("delete from better_auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
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
