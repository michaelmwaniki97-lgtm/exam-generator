import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const operatorUrl = process.env.LOCAL_DATABASE_ADMIN_URL ?? url;
const enabled = Boolean(url);

test("Better Auth application provisioning preserves UUID/profile metadata before and after identity cutover", { skip: !enabled }, async () => {
  const previousBackend = process.env.DATABASE_BACKEND;
  process.env.DATABASE_BACKEND = "postgres";
  const pool = new Pool({ connectionString: operatorUrl! });
  const userId = randomUUID();
  const email = `better-auth-bridge-${userId}@example.test`;
  try {
    const anchor = (await pool.query<{ target: string }>(
      `select n.nspname || '.' || t.relname as target
         from pg_constraint c
         join pg_class t on t.oid = c.confrelid
         join pg_namespace n on n.oid = t.relnamespace
        where c.conname = 'teachers_user_id_fkey'`,
    )).rows[0]?.target;
    assert.ok(anchor === "auth.users" || anchor === "better_auth.users");

    const grants = (await pool.query<{ runtime_can_assume_service: boolean; can_select: boolean; can_insert: boolean; can_update: boolean; can_delete: boolean }>(
      `select
         pg_has_role('exam_app_runtime', 'service_role', 'MEMBER') as runtime_can_assume_service,
         has_table_privilege('service_role', 'auth.users', 'SELECT') as can_select,
         has_table_privilege('service_role', 'auth.users', 'INSERT') as can_insert,
         has_table_privilege('service_role', 'auth.users', 'UPDATE') as can_update,
         has_table_privilege('service_role', 'auth.users', 'DELETE') as can_delete`,
    )).rows[0];
    assert.equal(grants?.runtime_can_assume_service, true);
    assert.equal(grants?.can_update, false);
    assert.equal(grants?.can_delete, false);
    assert.equal(grants?.can_select, anchor === "auth.users");
    assert.equal(grants?.can_insert, anchor === "auth.users");

    await pool.query(
      "insert into better_auth.users (id, name, email, email_verified) values ($1::uuid, $2, $3, false)",
      [userId, "Bridge Teacher", email],
    );

    const { provisionBetterAuthApplicationIdentity } = await import("./application-bridge.ts");
    await provisionBetterAuthApplicationIdentity({
      userId,
      email,
      name: "Bridge Teacher",
      school: "Bridge School",
      phone: "+254700000000",
    });

    const authUser = (await pool.query<{ id: string; email: string }>(
      "select id, email from auth.users where id = $1::uuid",
      [userId],
    )).rows[0];
    if (anchor === "auth.users") {
      assert.equal(authUser?.id, userId);
      assert.equal(authUser?.email, email);
    } else {
      assert.equal(authUser, undefined);
    }

    const teacher = (await pool.query<{ user_id: string; name: string; school: string | null; phone: string | null }>(
      "select user_id, name, school, phone from public.teachers where user_id = $1::uuid",
      [userId],
    )).rows[0];
    assert.deepEqual(teacher, {
      user_id: userId,
      name: "Bridge Teacher",
      school: "Bridge School",
      phone: "+254700000000",
    });
  } finally {
    try { await pool.query("delete from public.teachers where user_id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    try { await pool.query("delete from auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    try { await pool.query("delete from better_auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    await pool.end();
    try {
      const { closePostgresPool } = await import("../db/postgres-client.ts");
      await closePostgresPool();
    } catch { /* no pool may have been created */ }
    if (previousBackend === undefined) delete process.env.DATABASE_BACKEND;
    else process.env.DATABASE_BACKEND = previousBackend;
  }
});
