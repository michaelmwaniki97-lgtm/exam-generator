import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const enabled = Boolean(url);

test("Better Auth recovery issues a one-time token, resets credentials, and revokes sessions", { skip: !enabled }, async () => {
  const previous = {
    authBackend: process.env.AUTH_BACKEND,
    baseUrl: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
  };
  process.env.AUTH_BACKEND = "better-auth";
  process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET ||= "phase-4-disposable-integration-secret-000000000000";

  const email = `password-recovery-${randomUUID()}@example.test`;
  const oldPassword = "synthetic-phase4-old-password";
  const newPassword = "synthetic-phase4-new-password";
  const pool = new Pool({ connectionString: url!, options: "-c search_path=better_auth,public" });
  let userId: string | undefined;
  let resetToken: string | undefined;
  let resetUrl: string | undefined;

  try {
    const [{ betterAuth }, { buildBetterAuthOptions }] = await Promise.all([
      import("better-auth"),
      import("./options.ts"),
    ]);
    const options = buildBetterAuthOptions();
    const auth = betterAuth({
      ...options,
      plugins: [],
      emailAndPassword: {
        ...options.emailAndPassword,
        sendResetPassword: async ({ token, url: generatedUrl }: { token: string; url: string }) => {
          resetToken = token;
          resetUrl = generatedUrl;
        },
      },
    });

    const signup = await auth.api.signUpEmail({
      body: { name: "Password Recovery Teacher", email, password: oldPassword },
    });
    userId = signup.user.id;
    assert.ok(signup.token);

    const login = await auth.api.signInEmail({ body: { email, password: oldPassword } });
    assert.ok(login.token);
    const sessionsBefore = Number((await pool.query<{ count: string }>(
      "select count(*)::text as count from better_auth.sessions where user_id = $1::uuid",
      [userId],
    )).rows[0]?.count ?? "0");
    assert.ok(sessionsBefore >= 1);

    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "http://localhost:3000/reset-password" },
    });
    assert.ok(resetToken);
    assert.ok(resetUrl);
    assert.match(resetUrl!, /reset-password/);

    await auth.api.resetPassword({ body: { newPassword, token: resetToken! } });

    const sessionsAfter = Number((await pool.query<{ count: string }>(
      "select count(*)::text as count from better_auth.sessions where user_id = $1::uuid",
      [userId],
    )).rows[0]?.count ?? "0");
    assert.equal(sessionsAfter, 0);

    await assert.rejects(() => auth.api.signInEmail({ body: { email, password: oldPassword } }));
    const relogin = await auth.api.signInEmail({ body: { email, password: newPassword } });
    assert.equal(relogin.user.id, userId);
    assert.ok(relogin.token);

    await assert.rejects(() => auth.api.resetPassword({ body: { newPassword: oldPassword, token: resetToken! } }));
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
