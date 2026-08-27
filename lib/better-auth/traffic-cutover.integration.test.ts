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

test("post-cutover Better Auth HTTP handler authenticates a teacher and revokes the database session", { skip: !enabled }, async () => {
  const previous = {
    authBackend: process.env.AUTH_BACKEND,
    databaseBackend: process.env.DATABASE_BACKEND,
    baseUrl: process.env.BETTER_AUTH_URL,
    publicAppUrl: process.env.PUBLIC_APP_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    smtpUrl: process.env.SMTP_URL,
    emailFrom: process.env.AUTH_EMAIL_FROM,
  };

  process.env.AUTH_BACKEND = "better-auth";
  process.env.DATABASE_BACKEND = "postgres";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.PUBLIC_APP_URL = "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET = "phase-8-disposable-cutover-secret-000000000000000";
  process.env.SMTP_URL = "smtp://localhost:2525";
  process.env.AUTH_EMAIL_FROM = "Exam Generator <no-reply@example.test>";

  const pool = new Pool({ connectionString: url! });
  const email = `traffic-cutover-${randomUUID()}@example.test`;
  const password = "synthetic-phase8-password";
  let userId: string | undefined;

  try {
    const { assertBetterAuthTrafficEnvironment, isBetterAuthTrafficReady, readBetterAuthTrafficReadiness } = await import("./cutover-readiness.ts");
    assertBetterAuthTrafficEnvironment(process.env);
    assert.equal(isBetterAuthTrafficReady(await readBetterAuthTrafficReadiness(pool)), true);

    const [{ betterAuth }, { buildBetterAuthOptions }, { provisionBetterAuthApplicationIdentity }] = await Promise.all([
      import("better-auth"),
      import("./options.ts"),
      import("./application-bridge.ts"),
    ]);

    // The real Next.js build validates nextCookies. Raw Node exercises the same
    // Better Auth HTTP handler without a Next request context, so omit only the
    // response-adapter plugin in this disposable integration process.
    const auth = betterAuth({ ...buildBetterAuthOptions(), plugins: [] });
    const signup = await auth.api.signUpEmail({
      body: { name: "Traffic Cutover Teacher", email, password },
    });
    assert.ok(signup.user?.id);
    userId = signup.user.id;

    await provisionBetterAuthApplicationIdentity({
      userId,
      email,
      name: "Traffic Cutover Teacher",
      school: "Traffic Cutover School",
      phone: "+254700000008",
    });

    const signInResponse = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email, password, rememberMe: true }),
    }));
    assert.equal(signInResponse.status, 200);
    const cookie = sessionCookieFrom(signInResponse);

    const getSession = () => auth.handler(new Request("http://localhost:3000/api/auth/get-session", {
      method: "GET",
      headers: { cookie },
    }));
    const sessionResponse = await getSession();
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json() as { user?: { id?: string; email?: string } } | null;
    assert.equal(session?.user?.id, userId);
    assert.equal(session?.user?.email, email);

    // Raw Node cannot resolve Next's framework-only `next/headers` subpath.
    // The HTTP get-session call above already exercises Better Auth's real
    // database-backed session lookup, so normalize that trusted handler result
    // and exercise the PostgreSQL identity/RLS repository directly here.
    const { normalizeAuthenticatedUser } = await import("../auth-backend/normalize.ts");
    const authenticatedUser = normalizeAuthenticatedUser(session?.user);
    assert.equal(authenticatedUser?.id, userId);

    const { PostgresIdentityReadRepository } = await import("../identity-read/postgres.ts");
    const repository = new PostgresIdentityReadRepository(authenticatedUser!.id);
    assert.equal(await repository.resolveRole(), "teacher");

    const signOutResponse = await auth.handler(new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: "{}",
    }));
    assert.equal(signOutResponse.status, 200);

    const afterSignOut = await getSession();
    assert.equal(afterSignOut.status, 200);
    assert.equal(await afterSignOut.json(), null);
  } finally {
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
    restore("baseUrl", "BETTER_AUTH_URL");
    restore("publicAppUrl", "PUBLIC_APP_URL");
    restore("secret", "BETTER_AUTH_SECRET");
    restore("smtpUrl", "SMTP_URL");
    restore("emailFrom", "AUTH_EMAIL_FROM");
  }
});
