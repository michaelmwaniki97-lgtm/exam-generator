import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { PAYMENT_ATTEMPT_SELECT } from "../payment-attempt-read/contracts.ts";
import { SupabasePaymentStateWriteRepository } from "./supabase.ts";

type Response = { data?: unknown; error?: unknown };
function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]);
    const response = responses.shift() ?? {};
    const query = {
      update(...args: unknown[]) { calls.push(["update", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return query; },
      in(...args: unknown[]) { calls.push(["in", ...args]); return Promise.resolve(response); },
      select(...args: unknown[]) { calls.push(["select", ...args]); return query; },
      single() { calls.push(["single"]); return Promise.resolve(response); },
    };
    return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

const row = {
  id: "payment", exam_id: "exam", teacher_id: "teacher", amount: 100, currency: "KES",
  phone: "254700000001", provider: "card", status: "pending", external_request_id: "session",
  provider_request_id: "intent", provider_reference: null, created_at: "2026-08-27T10:00:00Z", completed_at: null,
};

test("payment-state-write backend remains environment-only with Supabase default", () => {
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

test("Supabase saveInitiation preserves accepted transition, status guard, and bounded projection", async () => {
  const { client, calls } = fakeClient([{ data: row, error: null }]);
  const changes = {
    status: "pending" as const, verification_status: "pending" as const,
    external_request_id: "session", provider_request_id: "intent", result_description: null,
    query_next_at: "2026-08-27T10:00:30Z", updated_at: "2026-08-27T10:00:00Z",
  };
  assert.deepEqual(await new SupabasePaymentStateWriteRepository(client).saveInitiation("payment", changes), row);
  assert.deepEqual(calls, [
    ["from", "payments"], ["update", changes], ["eq", "id", "payment"],
    ["eq", "status", "initiated"], ["select", PAYMENT_ATTEMPT_SELECT], ["single"],
  ]);
});

test("Supabase saveInitiation preserves rejected transition and null-on-write-failure", async () => {
  const changes = {
    status: "failed" as const, verification_status: "rejected" as const,
    result_description: "Payment request failed.", updated_at: "2026-08-27T10:00:00Z",
  };
  const fixture = fakeClient([{ data: null, error: { code: "fixture" } }]);
  assert.equal(await new SupabasePaymentStateWriteRepository(fixture.client).saveInitiation("payment", changes), null);
  assert.deepEqual(fixture.calls[1], ["update", changes]);
});

test("Supabase recordTerminal preserves best-effort state guard and undefined-field behavior", async () => {
  const fixture = fakeClient([{ error: { code: "ignored" } }]);
  await new SupabasePaymentStateWriteRepository(fixture.client).recordTerminal(
    "payment", "expired", undefined, undefined, "2026-08-27T11:00:00Z"
  );
  assert.deepEqual(fixture.calls, [
    ["from", "payments"],
    ["update", { status: "expired", verification_status: "rejected", result_code: undefined,
      result_description: undefined, updated_at: "2026-08-27T11:00:00Z" }],
    ["eq", "id", "payment"], ["in", "status", ["initiated", "pending"]],
  ]);
});

test("trusted write boundary stays server-only, narrow, provider-neutral, and separate from frozen domains", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, server, reporting, entitlement, attemptRead] = await Promise.all([
    readFile(new URL("lib/payment-state-write/index.ts", root), "utf8"),
    readFile(new URL("lib/payment-state-write/postgres.ts", root), "utf8"),
    readFile(new URL("lib/payments/server.ts", root), "utf8"),
    readFile(new URL("lib/payment-reporting/index.ts", root), "utf8"),
    readFile(new URL("lib/payment-entitlement/index.ts", root), "utf8"),
    readFile(new URL("lib/payment-attempt-read/index.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /createAdminClient\(\)/);
  assert.match(postgres, /withTrustedTransaction/);
  assert.doesNotMatch(postgres, /select\s+\*|returning\s+\*/i);
  assert.doesNotMatch(postgres, /set role|superuser|getPostgresPool/i);
  assert.doesNotMatch(server, /\.from\("payments"\).*\.(?:update|insert|upsert|delete)/s);
  assert.match(server, /getPaymentStateWriteRepository\(\)\.saveInitiation/);
  assert.match(server, /getPaymentStateWriteRepository\(\)\.recordTerminal/);
  assert.doesNotMatch(factory + postgres, /mpesa|daraja|checkout|merchant|receipt/i);
  assert.doesNotMatch(reporting + entitlement + attemptRead, /payment-state-write/);
});
