import assert from "node:assert/strict";
import test from "node:test";
import { closePostgresPool, getPostgresPool, withTrustedTransaction } from "../db/postgres-client.ts";
import { PaymentError } from "../payments/core.ts";
import { PostgresAppSettingsReadRepository } from "./postgres.ts";

const KEY = "exam_package_price";

function paymentCode(error: unknown): string | undefined {
  return error instanceof PaymentError ? error.code : undefined;
}

test("direct PostgreSQL setting read preserves trusted access, values, bounds, and failures", async (context) => {
  const original = await withTrustedTransaction(async (client) =>
    (await client.query<{ value: unknown }>("select value from public.app_settings where key = $1", [KEY])).rows[0] ?? null);
  const repository = new PostgresAppSettingsReadRepository();

  async function setValue(value: unknown) {
    await withTrustedTransaction(async (client) => {
      await client.query(
        "insert into public.app_settings(key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value",
        [KEY, JSON.stringify(value)],
      );
    });
  }

  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        if (original) {
          await client.query(
            "insert into public.app_settings(key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value",
            [KEY, JSON.stringify(original.value)],
          );
        } else {
          await client.query("delete from public.app_settings where key = $1", [KEY]);
        }
      });
    } finally {
      await closePostgresPool();
    }
  });

  for (const [stored, expected] of [[{ amount: 1 }, 1], [{ amount: "150" }, 150], [{ amount: 100_000 }, 100_000]] as const) {
    await setValue(stored);
    assert.equal(await repository.getExamPackagePrice(), expected);
  }

  for (const value of [null, "100", []]) {
    await setValue(value);
    await assert.rejects(() => repository.getExamPackagePrice(), (error) => paymentCode(error) === "NOT_CONFIGURED");
  }
  for (const amount of [undefined, "", "abc", "1.5", 0, -1, 1.5, 100_001]) {
    await setValue(amount === undefined ? {} : { amount });
    await assert.rejects(() => repository.getExamPackagePrice(), (error) => paymentCode(error) === "INVALID_PRICE");
  }

  await withTrustedTransaction((client) => client.query("delete from public.app_settings where key = $1", [KEY]));
  await assert.rejects(() => repository.getExamPackagePrice(), (error) => paymentCode(error) === "NOT_CONFIGURED");
  await assert.rejects(() => getPostgresPool().query("select value from public.app_settings where key = $1", [KEY]), /permission denied/);
});
