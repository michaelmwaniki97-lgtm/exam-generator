import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { validateExamPackagePrice } from "../payments/core.ts";
import { SupabaseAppSettingsWriteRepository } from "./supabase.ts";

function fakeClient(response: { error?: unknown } = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]);
    return {
      upsert(...args: unknown[]) { calls.push(["upsert", ...args]); return Promise.resolve(response); },
    };
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("app-settings-write backend remains environment-only with Supabase default", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND;
  assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase";
  assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres";
  assert.equal(getDatabaseBackendName(), "postgres");
  process.env.DATABASE_BACKEND = "browser";
  assert.throws(() => getDatabaseBackendName(), /supabase or postgres/);
  if (previous === undefined) delete process.env.DATABASE_BACKEND;
  else process.env.DATABASE_BACKEND = previous;
});

test("Supabase price upsert preserves fixed key, JSON shape, timestamp, and conflict target", async () => {
  const { client, calls } = fakeClient();
  const timestamp = "2026-08-27T12:34:56.000Z";
  await new SupabaseAppSettingsWriteRepository(client).upsertExamPackagePrice(275, timestamp);
  assert.deepEqual(calls, [
    ["from", "app_settings"],
    ["upsert", {
      key: "exam_package_price",
      value: { amount: 275, currency: "KES" },
      updated_at: timestamp,
    }, { onConflict: "key" }],
  ]);
});

test("Supabase settings write sanitizes database failures", async () => {
  const { client } = fakeClient({ error: { code: "42501", message: "private policy detail" } });
  await assert.rejects(
    () => new SupabaseAppSettingsWriteRepository(client).upsertExamPackagePrice(100, new Date(0).toISOString()),
    /^Error: App settings write failed\.$/
  );
});

test("price validation retains exact whole-KES range and rejection message", () => {
  for (const value of [1, "1", 100_000, "100000"]) {
    assert.equal(validateExamPackagePrice(value), Number(value));
  }
  for (const value of [0, -1, 100_001, 1.5, "1.5", " 100 ", "KES 100", null]) {
    assert.throws(
      () => validateExamPackagePrice(value),
      /Price must be a whole KES amount between 1 and 100000\./
    );
  }
});

test("settings write boundary preserves admin Auth/RLS, validation, messages, and revalidation", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, action] = await Promise.all([
    readFile(new URL("lib/app-settings-write/index.ts", root), "utf8"),
    readFile(new URL("lib/app-settings-write/postgres.ts", root), "utf8"),
    readFile(new URL("app/actions/payment-settings.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentUser\(\).*getUserRole\(\)/s);
  assert.match(factory, /isAdminRole\(role\)/);
  assert.match(factory, /PostgresAppSettingsWriteRepository\(user\.id\)/);
  assert.match(postgres, /withAuthenticatedTransaction/);
  assert.match(postgres, /insert into public\.app_settings \(key, value, updated_at\)/);
  assert.match(postgres, /on conflict \(key\) do update/);
  assert.doesNotMatch(factory + postgres, /withTrustedTransaction|service_role|getPostgresPool|bypassrls|returning \*/i);
  assert.doesNotMatch(action, /\.from\("app_settings"\)/);
  assert.match(action, /role !== "admin"/);
  assert.match(action, /validateExamPackagePrice\(formData\.get\("amount"\)\)/);
  assert.match(action, /upsertExamPackagePrice[\s\S]*amount,[\s\S]*new Date\(\)\.toISOString\(\)/);
  assert.match(action, /The download price could not be updated\./);
  assert.match(action, /revalidatePath\("\/admin\/settings"\)/);
  assert.match(action, /Exam-package price updated to KES \$\{amount\}\./);
});
