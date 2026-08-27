import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const enabled = Boolean(url);

test("temporary Better Auth application bridge preserves UUID/profile metadata with narrow service-role grants", { skip: !enabled }, async () => {
  const previousBackend = process.env.DATABASE_BACKEND;
  process.env.DATABASE_BACKEND = "postgres";
  const pool = new Pool({ connectionString: url! });
  const userId = randomUUID();
  const email = `better-auth-bridge-${userId}@example.test`;
  try {
    const grants = (await pool.query<{ runtime_can_assume_service: boolean; can_select: boolean; can_insert: boolean; can_update: boolean; can_delete: boolean }>(
      `select
         pg_has_role('exam_app_runtime', 'service_role', 'MEMBER') as runtime_can_assume_service,
         has_table_privilege('service_role', 'auth.users', 'SELECT') as can_select,
         has_table_privilege('service_role', 'auth.users', 'INSERT') as can_insert,
         has_table_privilege('service_role', 'auth.users', 'UPDATE') as can_update,
         has_table_privilege('service_role', 'auth.users', 'DELETE') as can_delete`,
    )).rows[0];
    assert.deepEqual(grants, {
      runtime_can_assume_service: true,
      can_select: true,
      can_insert: true,
      can_update: false,
      can_delete: false,
    });

    await pool.query(
      "insert into better_auth.users (id, name, email, email_verified) values ($1::uuid, $2, $3, false)",
      [userId, "Bridge Teacher", email],
    );

    // Import under Node's react-server condition so the real server-only helper
    // is exercised rather than duplicating its SQL in the test.
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
    assert.equal(authUser?.id, userId);
    assert.equal(authUser?.email, email);

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
