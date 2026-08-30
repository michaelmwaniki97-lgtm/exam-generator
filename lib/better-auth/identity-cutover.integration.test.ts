import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
const operatorUrl = process.env.LOCAL_DATABASE_ADMIN_URL ?? url;
const enabled = Boolean(url);

test("manual identity cutover anchors application FKs to Better Auth and preserves authenticated RLS", { skip: !enabled }, async () => {
  const previousBackend = process.env.DATABASE_BACKEND;
  process.env.DATABASE_BACKEND = "postgres";
  const pool = new Pool({ connectionString: operatorUrl! });
  const userId = randomUUID();
  const email = `better-auth-cutover-${userId}@example.test`;

  try {
    const constraints = (await pool.query<{ constraint_name: string; target_schema: string; target_table: string; delete_action: string; validated: boolean }>(
      `select c.conname as constraint_name,
              n.nspname as target_schema,
              t.relname as target_table,
              c.confdeltype::text as delete_action,
              c.convalidated as validated
         from pg_constraint c
         join pg_class t on t.oid = c.confrelid
         join pg_namespace n on n.oid = t.relnamespace
        where c.conname in (
          'teachers_user_id_fkey',
          'admins_user_id_fkey',
          'textbook_documents_uploaded_by_fkey'
        )
        order by c.conname`,
    )).rows;

    assert.deepEqual(constraints, [
      { constraint_name: "admins_user_id_fkey", target_schema: "better_auth", target_table: "users", delete_action: "c", validated: true },
      { constraint_name: "teachers_user_id_fkey", target_schema: "better_auth", target_table: "users", delete_action: "c", validated: true },
      { constraint_name: "textbook_documents_uploaded_by_fkey", target_schema: "better_auth", target_table: "users", delete_action: "r", validated: true },
    ]);

    const legacyBridge = (await pool.query<{ trigger_exists: boolean; can_select: boolean; can_insert: boolean }>(
      `select
         exists(
           select 1 from pg_trigger
            where tgrelid = 'auth.users'::regclass
              and tgname = 'on_auth_user_created'
              and not tgisinternal
         ) as trigger_exists,
         has_table_privilege('service_role', 'auth.users', 'SELECT') as can_select,
         has_table_privilege('service_role', 'auth.users', 'INSERT') as can_insert`,
    )).rows[0];
    assert.deepEqual(legacyBridge, { trigger_exists: false, can_select: false, can_insert: false });

    await pool.query(
      "insert into better_auth.users (id, name, email, email_verified) values ($1::uuid, $2, $3, true)",
      [userId, "Cutover Teacher", email],
    );

    const { provisionBetterAuthApplicationIdentity } = await import("./application-bridge.ts");
    await provisionBetterAuthApplicationIdentity({
      userId,
      email,
      name: "Cutover Teacher",
      school: "Cutover School",
      phone: "+254700000001",
    });

    assert.equal((await pool.query("select 1 from auth.users where id = $1::uuid", [userId])).rowCount, 0);
    const teacher = (await pool.query<{ id: string; user_id: string; name: string; school: string | null; phone: string | null }>(
      "select id, user_id, name, school, phone from public.teachers where user_id = $1::uuid",
      [userId],
    )).rows[0];
    assert.equal(teacher?.user_id, userId);
    assert.equal(teacher?.name, "Cutover Teacher");
    assert.equal(teacher?.school, "Cutover School");
    assert.equal(teacher?.phone, "+254700000001");

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [userId]);
      const rls = (await client.query<{ uid: string | null; teacher_id: string | null; visible: number }>(
        `select auth.uid()::text as uid,
                public.current_teacher_id()::text as teacher_id,
                (select count(*)::int from public.teachers where user_id = auth.uid()) as visible`,
      )).rows[0];
      assert.equal(rls?.uid, userId);
      assert.equal(rls?.teacher_id, teacher?.id);
      assert.equal(rls?.visible, 1);
      await client.query("rollback");
    } finally {
      client.release();
    }

    await pool.query("delete from better_auth.users where id = $1::uuid", [userId]);
    assert.equal((await pool.query("select 1 from public.teachers where user_id = $1::uuid", [userId])).rowCount, 0);
  } finally {
    try { await pool.query("delete from public.teachers where user_id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    try { await pool.query("delete from better_auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    try { await pool.query("delete from auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    await pool.end();
    try {
      const { closePostgresPool } = await import("../db/postgres-client.ts");
      await closePostgresPool();
    } catch { /* no pool may have been created */ }
    if (previousBackend === undefined) delete process.env.DATABASE_BACKEND;
    else process.env.DATABASE_BACKEND = previousBackend;
  }
});
