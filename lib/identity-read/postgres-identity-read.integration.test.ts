import assert from "node:assert/strict";
import test from "node:test";
import { closePostgresPool, getPostgresPool, queryRows, withAuthenticatedTransaction, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresIdentityReadRepository } from "./postgres.ts";

const TEACHER_A = "00000000-0000-4000-8000-000000000001";
const TEACHER_B = "00000000-0000-4000-8000-000000000002";
const ADMIN_DUAL_ROLE = "00000000-0000-4000-8000-000000000005";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL identity reads preserve self mapping, role precedence, and cross-role denial", async (context) => {
  context.after(closePostgresPool);
  const a = new PostgresIdentityReadRepository(TEACHER_A);
  const b = new PostgresIdentityReadRepository(TEACHER_B);
  const admin = new PostgresIdentityReadRepository(ADMIN_DUAL_ROLE);
  const unknown = new PostgresIdentityReadRepository(UNKNOWN);

  const aIdentity = await a.getTeacherIdentity();
  const bIdentity = await b.getTeacherIdentity();
  assert.ok(aIdentity && bIdentity && aIdentity.id !== bIdentity.id);
  assert.equal(await a.getAdminIdentity(), null);
  assert.equal(await b.getAdminIdentity(), null);
  assert.equal(await a.resolveRole(), "teacher");
  assert.equal(await b.resolveRole(), "teacher");
  assert.deepEqual(await a.getTeacherHeaderProfile(), { name: "Teacher One", school: null });
  assert.deepEqual(await a.getTeacherProfile(), { name: "Teacher One", school: null, phone: null });

  assert.ok(await admin.getAdminIdentity());
  assert.ok(await admin.getTeacherIdentity(), "current signup trigger permits an admin auth user to also have a teacher row");
  assert.equal(await admin.resolveRole(), "admin");
  assert.deepEqual(await admin.getAdminDisplayProfile(), { name: "Parity Admin" });
  assert.ok(await admin.countTeachersForAdmin() >= 2);
  const teachers = await admin.listTeachersForAdmin();
  assert.ok(teachers.some((row) => row.id === aIdentity.id));
  assert.ok(teachers.every((row) => Object.keys(row).sort().join() === "created_at,id,name,phone,school"));

  assert.equal(await unknown.getTeacherIdentity(), null);
  assert.equal(await unknown.getAdminIdentity(), null);
  assert.equal(await unknown.resolveRole(), null);
  await assert.rejects(() => a.countTeachersForAdmin(), /Administrator access/);
  await assert.rejects(() => unknown.listTeachersForAdmin(), /Administrator access/);

  for (const userId of [TEACHER_A, TEACHER_B, ADMIN_DUAL_ROLE, UNKNOWN]) {
    const applicationAdmin = (await new PostgresIdentityReadRepository(userId).getAdminIdentity()) !== null;
    const databaseAdmin = await withAuthenticatedTransaction(userId, async (client) =>
      (await queryRows<{ allowed: boolean }>(client, "select public.is_admin() as allowed", []))[0]?.allowed ?? false);
    assert.equal(applicationAdmin, databaseAdmin);
  }
  await withTrustedTransaction(async (client) => {
    const indexes = await queryRows<{ tablename: string; indexdef: string }>(client,
      "select tablename, indexdef from pg_indexes where schemaname = 'public' and tablename = any($1::text[])", [["teachers", "admins"]]);
    assert.ok(indexes.some((row) => row.tablename === "teachers" && row.indexdef.includes("UNIQUE") && row.indexdef.includes("user_id")));
    assert.ok(indexes.some((row) => row.tablename === "admins" && row.indexdef.includes("UNIQUE") && row.indexdef.includes("user_id")));
  });
  await assert.rejects(() => getPostgresPool().query("select id from public.teachers"), /permission denied/);
  await assert.rejects(() => getPostgresPool().query("select id from public.admins"), /permission denied/);
});
