import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getDatabaseBackendName } from "../db/config.ts";
import { PAYMENT_ATTEMPT_SELECT } from "./contracts.ts";
import { SupabasePaymentAttemptReadRepository } from "./supabase.ts";

type Call = [string, ...unknown[]];
function mockClient(results: unknown[]) {
  const calls: Call[] = [];
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) chain[method] = (...args: unknown[]) => { calls.push([method, ...args]); return chain; };
  chain.maybeSingle = () => { calls.push(["maybeSingle"]); return Promise.resolve(results.shift() ?? { data: null }); };
  return { client: { from(table: string) { calls.push(["from", table]); return chain; } }, calls };
}

const row = {
  id: "00000000-0000-4000-8000-000000000011", exam_id: "00000000-0000-4000-8000-000000000021",
  teacher_id: "00000000-0000-4000-8000-000000000031", amount: 100, currency: "KES", phone: "254712345678",
  provider: "cardfixture", status: "pending", external_request_id: "card-session", provider_request_id: null,
  provider_reference: null, created_at: "2026-08-01T00:00:00.000Z", completed_at: null,
};

test("payment attempt backend remains environment-only with Supabase default", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase"; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres"; assert.equal(getDatabaseBackendName(), "postgres");
  if (previous === undefined) delete process.env.DATABASE_BACKEND; else process.env.DATABASE_BACKEND = previous;
});

test("Supabase adapter preserves all three historical query contracts and normalization", async () => {
  const { client, calls } = mockClient([{ data: row }, { data: row }, { data: row }, { data: null }, { data: null, error: { code: "database" } }]);
  const repository = new SupabasePaymentAttemptReadRepository(client as never);
  assert.equal((await repository.getAttempt(row.id))?.provider, "cardfixture");
  assert.equal((await repository.getAttemptByExternalRequest("daraja", "checkout-a"))?.externalRequestId, "card-session");
  assert.equal((await repository.getLatestAttemptForExam(row.teacher_id, row.exam_id))?.amount, 100);
  assert.equal(await repository.getAttempt("missing"), null);
  assert.equal(await repository.getAttempt("query-error"), null);
  assert.equal(calls.filter((call) => call[0] === "select" && call[1] === PAYMENT_ATTEMPT_SELECT).length, 5);
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "id" && call[2] === row.id));
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "provider" && call[2] === "daraja"));
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "external_request_id" && call[2] === "checkout-a"));
  assert.ok(calls.some((call) => call[0] === "in" && call[1] === "status" && JSON.stringify(call[2]) === JSON.stringify(["initiated", "pending", "paid"])));
  assert.ok(calls.some((call) => call[0] === "order" && call[1] === "created_at" && (call[2] as { ascending: boolean }).ascending === false));
  assert.ok(calls.some((call) => call[0] === "limit" && call[1] === 1));
});

test("attempt contract is provider-neutral, minimized, and preserves validation", async () => {
  const { client } = mockClient([{ data: { ...row, amount: 1.5 } }, { data: { ...row, currency: "USD" } }, { data: { ...row, status: "unknown" } }]);
  const repository = new SupabasePaymentAttemptReadRepository(client as never);
  await assert.rejects(() => repository.getAttempt(row.id), /Stored payment data is invalid/);
  await assert.rejects(() => repository.getAttempt(row.id), /Stored payment data is invalid/);
  await assert.rejects(() => repository.getAttempt(row.id), /Stored payment data is invalid/);
  assert.doesNotMatch(PAYMENT_ATTEMPT_SELECT, /verification_status|mpesa_ref|query_|result_|idempotency_key|updated_at/);
  assert.match(PAYMENT_ATTEMPT_SELECT, /provider.*external_request_id.*provider_request_id.*provider_reference/);
});

test("trusted attempt boundary is server-only, explicit, and separated from reporting and entitlement", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, server, daraja, reporting, entitlement] = await Promise.all([
    readFile(new URL("lib/payment-attempt-read/index.ts", root), "utf8"), readFile(new URL("lib/payment-attempt-read/postgres.ts", root), "utf8"),
    readFile(new URL("lib/payments/server.ts", root), "utf8"), readFile(new URL("lib/payments/daraja-service.ts", root), "utf8"),
    readFile(new URL("lib/payment-reporting/index.ts", root), "utf8"), readFile(new URL("lib/payment-entitlement/index.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/); assert.match(factory, /createAdminClient\(\)/);
  assert.match(postgres, /withTrustedTransaction/); assert.doesNotMatch(postgres, /select\s+\*/i);
  assert.match(postgres, /where id = \$1::uuid/); assert.match(postgres, /provider = \$1 and external_request_id = \$2/);
  assert.match(postgres, /exam_id = \$1::uuid and teacher_id = \$2::uuid and status = any\(\$3::text\[\]\)/);
  assert.match(postgres, /order by created_at desc limit 1/); assert.doesNotMatch(postgres, /order by created_at desc\s*,|set role|superuser/i);
  assert.match(server, /assertOwnedExam\(actor, examId\)[\s\S]*getLatestAttemptForExam\(actor\.teacherId, examId\)/);
  assert.match(server, /getAttemptByExternalRequest\("daraja", externalRequestId\)/);
  assert.match(daraja, /getAttemptByExternalRequest\(input\.callback\.checkoutRequestId\)/);
  assert.doesNotMatch(factory + server, /request\.json|formData\.get\(["'](?:paymentId|teacherId|provider)|searchParams.*DATABASE_BACKEND/);
  assert.doesNotMatch(reporting + entitlement, /payment-attempt-read/);
});
