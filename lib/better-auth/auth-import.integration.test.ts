import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import bcrypt from "bcrypt";
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { upgradeImportedCredentialHashIfNeeded } from "./credential-upgrade.ts";
import { importSupabaseAuthExport } from "./import.ts";
import { isSupabaseBcryptHash } from "./password-migration.ts";
import { buildBetterAuthOptions } from "./options.ts";

const url = process.env.DATABASE_URL;
const operatorUrl = process.env.LOCAL_DATABASE_ADMIN_URL ?? url;
const enabled = Boolean(url);

test("Supabase bcrypt import preserves UUID, authenticates, upgrades to scrypt, and is rerunnable", { skip: !enabled }, async () => {
  const previous = {
    authBackend: process.env.AUTH_BACKEND,
    baseUrl: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
  };
  process.env.AUTH_BACKEND = "better-auth";
  process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
  process.env.BETTER_AUTH_SECRET ||= "phase-6-disposable-integration-secret-000000000000";

  const id = randomUUID();
  const email = `import-${id}@example.test`;
  const password = "synthetic-import-password";
  const legacyHash = await bcrypt.hash(password, 10);
  const pool = new Pool({ connectionString: operatorUrl!, options: "-c search_path=better_auth,public" });

  try {
    const readinessIndex = (await pool.query<{ name: string | null }>(
      "select to_regclass('better_auth.better_auth_users_lower_email_key')::text as name",
    )).rows[0]?.name;
    assert.equal(readinessIndex, "better_auth_users_lower_email_key");

    await pool.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1::uuid, $2, $3::jsonb)`,
      [id, email, JSON.stringify({ name: "Imported Teacher" })],
    );

    const record = {
      id,
      email,
      encrypted_password: legacyHash,
      email_confirmed_at: "2026-01-01T00:00:00.000Z",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      raw_user_meta_data: { name: "Imported Teacher" },
    };

    const dryRun = await importSupabaseAuthExport(pool, [record]);
    assert.equal(dryRun.insertedUsers, 1);
    assert.equal(dryRun.insertedCredentials, 1);
    assert.equal((await pool.query("select 1 from better_auth.users where id = $1::uuid", [id])).rowCount, 0);

    const applied = await importSupabaseAuthExport(pool, [record], { dryRun: false });
    assert.equal(applied.insertedUsers, 1);
    assert.equal(applied.insertedCredentials, 1);

    const imported = (await pool.query<{ id: string; email: string; email_verified: boolean }>(
      "select id, email, email_verified from better_auth.users where id = $1::uuid",
      [id],
    )).rows[0];
    assert.deepEqual(imported, { id, email, email_verified: true });

    const accountBefore = (await pool.query<{ password: string | null }>(
      "select password from better_auth.accounts where user_id = $1::uuid and provider_id = 'credential'",
      [id],
    )).rows[0];
    assert.equal(accountBefore?.password, legacyHash);

    const options = buildBetterAuthOptions();
    const auth = betterAuth({ ...options, plugins: [] });
    const loginBefore = await auth.api.signInEmail({ body: { email, password } });
    assert.equal(loginBefore.user.id, id);

    assert.equal(await upgradeImportedCredentialHashIfNeeded(id, password), true);
    const accountAfter = (await pool.query<{ password: string | null }>(
      "select password from better_auth.accounts where user_id = $1::uuid and provider_id = 'credential'",
      [id],
    )).rows[0];
    assert.ok(accountAfter?.password);
    assert.equal(isSupabaseBcryptHash(accountAfter.password!), false);
    assert.notEqual(accountAfter.password, legacyHash);

    const loginAfter = await auth.api.signInEmail({ body: { email, password } });
    assert.equal(loginAfter.user.id, id);

    const rerun = await importSupabaseAuthExport(pool, [record], { dryRun: false });
    assert.equal(rerun.existingUsers, 1);
    assert.equal(rerun.upgradedCredentialsPreserved, 1);
    const finalHash = (await pool.query<{ password: string }>(
      "select password from better_auth.accounts where user_id = $1::uuid and provider_id = 'credential'",
      [id],
    )).rows[0]?.password;
    assert.equal(finalHash, accountAfter.password);
  } finally {
    try { await pool.query("delete from better_auth.users where id = $1::uuid", [id]); } catch { /* disposable cleanup */ }
    try { await pool.query("delete from auth.users where id = $1::uuid", [id]); } catch { /* disposable cleanup */ }
    await pool.end();
    try {
      const { closeBetterAuthPool } = await import("./pool.ts");
      await closeBetterAuthPool();
    } catch { /* no global pool may exist */ }

    if (previous.authBackend === undefined) delete process.env.AUTH_BACKEND;
    else process.env.AUTH_BACKEND = previous.authBackend;
    if (previous.baseUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = previous.baseUrl;
    if (previous.secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous.secret;
  }
});
