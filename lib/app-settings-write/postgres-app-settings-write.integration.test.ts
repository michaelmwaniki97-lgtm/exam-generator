import assert from "node:assert/strict";
import test from "node:test";
import { closePostgresPool, getPostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresAppSettingsWriteRepository } from "./postgres.ts";

const ADMIN_DUAL_ROLE = "00000000-0000-4000-8000-000000000005";
const TEACHER = "00000000-0000-4000-8000-000000000001";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";
const KEY = "exam_package_price";

test("direct PostgreSQL price upsert preserves admin RLS, JSON shape, conflict update, and timestamps", async (context) => {
  const original = await withTrustedTransaction(async (client) =>
    (await queryRows<{ value: unknown; updated_at: Date }>(client,
      "select value, updated_at from public.app_settings where key = $1::text", [KEY]))[0] ?? null);
  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        if (original) {
          await client.query(
            `insert into public.app_settings (key, value, updated_at) values ($1::text, $2::jsonb, $3::timestamptz)
             on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
            [KEY, JSON.stringify(original.value), original.updated_at]
          );
        } else {
          await client.query("delete from public.app_settings where key = $1::text", [KEY]);
        }
      });
    } finally { await closePostgresPool(); }
  });

  const repository = new PostgresAppSettingsWriteRepository(ADMIN_DUAL_ROLE);
  const firstAt = "2026-08-27T10:00:00.000Z";
  await repository.upsertExamPackagePrice(125, firstAt);
  assert.deepEqual(await withTrustedTransaction(async (client) => {
    const row = (await queryRows<{ value: unknown; updated_at: Date }>(client,
      "select value, updated_at from public.app_settings where key = $1::text", [KEY]))[0];
    return { value: row?.value, updatedAt: row?.updated_at.toISOString() };
  }), { value: { amount: 125, currency: "KES" }, updatedAt: firstAt });

  const secondAt = "2026-08-27T11:00:00.000Z";
  await repository.upsertExamPackagePrice(100_000, secondAt);
  assert.deepEqual(await withTrustedTransaction(async (client) => {
    const row = (await queryRows<{ value: unknown; updated_at: Date }>(client,
      "select value, updated_at from public.app_settings where key = $1::text", [KEY]))[0];
    return { value: row?.value, updatedAt: row?.updated_at.toISOString() };
  }), { value: { amount: 100_000, currency: "KES" }, updatedAt: secondAt });

  for (const userId of [TEACHER, UNKNOWN]) {
    await assert.rejects(
      () => new PostgresAppSettingsWriteRepository(userId).upsertExamPackagePrice(200, new Date().toISOString()),
      /row-level security|permission denied/i
    );
  }
  await assert.rejects(
    () => getPostgresPool().query(
      "update public.app_settings set value = '{\"amount\":1,\"currency\":\"KES\"}'::jsonb where key = $1::text",
      [KEY]
    ),
    /permission denied/i
  );
});
