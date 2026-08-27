import assert from "node:assert/strict";
import test from "node:test";
import { closePostgresPool, getPostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresIdentityReadRepository } from "../identity-read/postgres.ts";
import { PostgresTeacherProfileWriteRepository } from "./postgres.ts";

const TEACHER_A = "00000000-0000-4000-8000-000000000001";
const TEACHER_B = "00000000-0000-4000-8000-000000000002";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL profile update preserves self-only RLS, nullable fields, and read-after-write", async (context) => {
  const originals = await withTrustedTransaction((client) => queryRows<{
    user_id: string; name: string; school: string | null; phone: string | null;
  }>(client,
    "select user_id, name, school, phone from public.teachers where user_id = any($1::uuid[]) order by user_id",
    [[TEACHER_A, TEACHER_B]]));
  assert.equal(originals.length, 2);
  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        for (const row of originals) {
          await client.query(
            "update public.teachers set name = $2::text, school = $3::text, phone = $4::text where user_id = $1::uuid",
            [row.user_id, row.name, row.school, row.phone]
          );
        }
      });
    } finally { await closePostgresPool(); }
  });

  const beforeB = await new PostgresIdentityReadRepository(TEACHER_B).getTeacherProfile();
  const writerA = new PostgresTeacherProfileWriteRepository(TEACHER_A);
  await writerA.updateProfile({ name: "Synthetic Teacher A", school: "Synthetic School", phone: "254700000001" });
  assert.deepEqual(await new PostgresIdentityReadRepository(TEACHER_A).getTeacherProfile(), {
    name: "Synthetic Teacher A", school: "Synthetic School", phone: "254700000001",
  });
  assert.deepEqual(await new PostgresIdentityReadRepository(TEACHER_B).getTeacherProfile(), beforeB);

  await writerA.updateProfile({ name: "Synthetic Teacher A Nulls", school: null, phone: null });
  assert.deepEqual(await new PostgresIdentityReadRepository(TEACHER_A).getTeacherProfile(), {
    name: "Synthetic Teacher A Nulls", school: null, phone: null,
  });

  // Historical update-with-no-matching-row semantics are success/no-op.
  await new PostgresTeacherProfileWriteRepository(UNKNOWN).updateProfile({
    name: "Unknown", school: null, phone: null,
  });
  assert.equal((await withTrustedTransaction((client) => queryRows<{ count: string }>(client,
    "select count(*)::text as count from public.teachers where user_id = $1::uuid", [UNKNOWN])))[0]?.count, "0");

  await assert.rejects(
    () => getPostgresPool().query("update public.teachers set name = 'raw unauthenticated' where user_id = $1::uuid", [TEACHER_A]),
    /permission denied/i
  );
});
