import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const enabled = Boolean(url);

test("Better Auth foundation preserves UUIDs, sessions, accounts, verification, and email uniqueness", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: url!, options: "-c search_path=better_auth,public" });
  const userId = randomUUID();
  const sessionId = randomUUID();
  const accountId = randomUUID();
  const verificationId = randomUUID();
  const email = `better-auth-${userId}@example.test`;
  try {
    await pool.query("begin");
    await pool.query(
      "insert into better_auth.users (id, name, email, email_verified) values ($1::uuid, $2, $3, true)",
      [userId, "Synthetic Auth User", email],
    );
    const user = (await pool.query<{ id: string }>("select id from better_auth.users where email = $1", [email])).rows[0];
    assert.equal(user?.id, userId);

    await assert.rejects(
      () => pool.query(
        "insert into better_auth.users (name, email) values ($1, $2)",
        ["Duplicate", email],
      ),
      /duplicate key|unique/i,
    );

    // PostgreSQL aborts a transaction after a constraint error. Roll back the
    // synthetic transaction, then start a fresh one for the remaining contract.
    await pool.query("rollback");
    await pool.query("begin");
    await pool.query(
      "insert into better_auth.users (id, name, email, email_verified) values ($1::uuid, $2, $3, true)",
      [userId, "Synthetic Auth User", email],
    );
    await pool.query(
      "insert into better_auth.sessions (id, user_id, token, expires_at) values ($1::uuid, $2::uuid, $3, now() + interval '1 hour')",
      [sessionId, userId, `session-${sessionId}`],
    );
    await pool.query(
      "insert into better_auth.accounts (id, user_id, issuer, account_id, provider_id, password) values ($1::uuid, $2::uuid, 'local:credential', $2, 'credential', $3)",
      [accountId, userId, "synthetic-password-hash"],
    );
    await pool.query(
      "insert into better_auth.verifications (id, identifier, value, expires_at) values ($1::uuid, $2, $3, now() - interval '1 minute')",
      [verificationId, `reset:${email}`, "synthetic-token",],
    );

    const session = (await pool.query<{ user_id: string; expired: boolean }>(
      "select user_id, expires_at < now() as expired from better_auth.sessions where id = $1::uuid",
      [sessionId],
    )).rows[0];
    assert.equal(session?.user_id, userId);
    assert.equal(session?.expired, false);

    const verification = (await pool.query<{ expired: boolean }>(
      "select expires_at < now() as expired from better_auth.verifications where id = $1::uuid",
      [verificationId],
    )).rows[0];
    assert.equal(verification?.expired, true);
  } finally {
    try { await pool.query("rollback"); } catch { /* disposable test cleanup */ }
    await pool.end();
  }
});
