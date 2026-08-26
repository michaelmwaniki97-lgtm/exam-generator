import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { PaymentError } from "../payments/core.ts";
import { examPackagePriceFromSetting } from "./contracts.ts";
import { SupabaseAppSettingsReadRepository } from "./supabase.ts";

type Response = { data?: unknown; error?: unknown };

function fakeClient(response: Response) {
  const calls: Array<[string, ...unknown[]]> = [];
  const query = {
    select(...args: unknown[]) { calls.push(["select", ...args]); return query; },
    eq(...args: unknown[]) { calls.push(["eq", ...args]); return query; },
    maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(response); },
  };
  const client = { from(table: string) { calls.push(["from", table]); return query; } };
  return { client: client as unknown as SupabaseClient, calls };
}

function paymentCode(error: unknown): string | undefined {
  return error instanceof PaymentError ? error.code : undefined;
}

test("app-settings backend remains environment-only with Supabase default", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND;
  assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase";
  assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres";
  assert.equal(getDatabaseBackendName(), "postgres");
  if (previous === undefined) delete process.env.DATABASE_BACKEND;
  else process.env.DATABASE_BACKEND = previous;
});

test("setting normalization preserves whole-KES bounds and historical failures", () => {
  assert.equal(examPackagePriceFromSetting({ value: { amount: 1, currency: "KES" } }), 1);
  assert.equal(examPackagePriceFromSetting({ value: { amount: "150", currency: "ignored historically" } }), 150);
  assert.equal(examPackagePriceFromSetting({ value: { amount: 100_000 } }), 100_000);

  for (const row of [null, { value: null }, { value: "100" }, { value: [] }]) {
    assert.throws(() => examPackagePriceFromSetting(row), (error) => paymentCode(error) === "NOT_CONFIGURED");
  }
  for (const amount of [undefined, "", "abc", "1.5", 0, -1, 1.5, 100_001]) {
    assert.throws(() => examPackagePriceFromSetting({ value: { amount } }), (error) => paymentCode(error) === "INVALID_PRICE");
  }
});

test("Supabase adapter preserves the fixed key, projection, maybeSingle, and error contract", async () => {
  const success = fakeClient({ data: { value: { amount: 100, currency: "KES" } }, error: null });
  assert.equal(await new SupabaseAppSettingsReadRepository(success.client).getExamPackagePrice(), 100);
  assert.deepEqual(success.calls, [
    ["from", "app_settings"], ["select", "value"], ["eq", "key", "exam_package_price"], ["maybeSingle"],
  ]);

  for (const response of [{ data: null, error: null }, { data: null, error: { message: "safe fixture" } }]) {
    const fixture = fakeClient(response);
    await assert.rejects(
      () => new SupabaseAppSettingsReadRepository(fixture.client).getExamPackagePrice(),
      (error) => paymentCode(error) === "NOT_CONFIGURED",
    );
  }
});

test("settings boundary is server-only, fixed-key, trusted-parity, and cannot accept browser amount/backend/role", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, payments, action, settingsWrite] = await Promise.all([
    readFile(new URL("lib/app-settings-read/index.ts", root), "utf8"),
    readFile(new URL("lib/app-settings-read/postgres.ts", root), "utf8"),
    readFile(new URL("lib/payments/server.ts", root), "utf8"),
    readFile(new URL("app/actions/payments.ts", root), "utf8"),
    readFile(new URL("app/actions/payment-settings.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.doesNotMatch(factory, /headers\(|cookies\(|request\.json|searchParams/);
  assert.match(postgres, /withTrustedTransaction/);
  assert.match(postgres, /where key = \$1/);
  assert.doesNotMatch(postgres, /select\s+\*/i);
  assert.doesNotMatch(postgres, /withAuthenticatedTransaction|set role|service_role/i);
  assert.match(payments, /getAppSettingsReadRepository\(\)\.getExamPackagePrice\(\)/);
  assert.doesNotMatch(action, /formData\.get\(["']amount|input\.amount|amount\s*:/);
  assert.match(settingsWrite, /\.from\("app_settings"\)\.upsert/);
});
