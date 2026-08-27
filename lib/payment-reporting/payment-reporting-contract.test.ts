import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { wholeKesTotal } from "./contracts.ts";
import { SupabaseAdminPaymentReportingRepository, SupabaseTeacherPaymentReportingRepository } from "./supabase.ts";

type Response = { data?: unknown; error?: unknown };

function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]);
    const response = responses.shift() ?? { data: [] };
    const query = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return query; },
      order(...args: unknown[]) { calls.push(["order", ...args]); return query; },
      limit(...args: unknown[]) { calls.push(["limit", ...args]); return Promise.resolve(response); },
      then(resolve: (value: Response) => unknown) { return Promise.resolve(response).then(resolve); },
    };
    return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("payment reporting backend remains environment-only with Supabase default", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase"; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres"; assert.equal(getDatabaseBackendName(), "postgres");
  process.env.DATABASE_BACKEND = "browser"; assert.throws(() => getDatabaseBackendName(), /supabase or postgres/);
  if (previous === undefined) delete process.env.DATABASE_BACKEND; else process.env.DATABASE_BACKEND = previous;
});

test("Supabase teacher history preserves projection, ownership, ordering, limit, nulls, and statuses", async () => {
  const databaseRows = [
    { id: "paid", amount: 100, currency: "KES", status: "paid", mpesa_ref: "RECEIPT", created_at: "2026-01-02", completed_at: "2026-01-03", exams: { exam_type: "CAT" } },
    { id: "pending", amount: 100, currency: "KES", status: "pending", mpesa_ref: null, created_at: "2026-01-01", completed_at: null, exams: { exam_type: "Exam" } },
  ];
  const expected = databaseRows.map(({ mpesa_ref, ...row }) => ({ ...row, receiptReference: mpesa_ref }));
  const { client, calls } = fakeClient([{ data: databaseRows }, { data: [] }]);
  const repository = new SupabaseTeacherPaymentReportingRepository(client, "teacher-a");
  assert.deepEqual(await repository.listTeacherPaymentHistory(), expected);
  assert.deepEqual(await repository.listTeacherPaymentHistory(), []);
  assert.deepEqual(calls.slice(0, 6), [
    ["from", "payments"],
    ["select", "id, amount, currency, status, mpesa_ref, created_at, completed_at, exams(exam_type)"],
    ["eq", "teacher_id", "teacher-a"],
    ["order", "created_at", { ascending: false }],
    ["limit", 100],
    ["from", "payments"],
  ]);
});

test("Supabase admin revenue preserves paid-only whole-KES aggregation and zero", async () => {
  const { client, calls } = fakeClient([{ data: [{ amount: 100 }, { amount: 250 }] }, { data: [] }]);
  const repository = new SupabaseAdminPaymentReportingRepository(client);
  assert.equal(await repository.getAdminPaidRevenue(), 350);
  assert.equal(await repository.getAdminPaidRevenue(), 0);
  assert.deepEqual(calls.slice(0, 3), [["from", "payments"], ["select", "amount"], ["eq", "status", "paid"]]);
  assert.equal(wholeKesTotal(["9007199254740991"]), Number.MAX_SAFE_INTEGER);
  assert.throws(() => wholeKesTotal(["9007199254740992"]), /safe display range/);
  assert.throws(() => wholeKesTotal(["1.5"]), /whole-KES/);
});

test("reporting boundary preserves role-specific execution and cannot become payment authorization", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, contracts, teacherPage, adminPage, payments] = await Promise.all([
    readFile(new URL("lib/payment-reporting/index.ts", root), "utf8"),
    readFile(new URL("lib/payment-reporting/postgres.ts", root), "utf8"),
    readFile(new URL("lib/payment-reporting/contracts.ts", root), "utf8"),
    readFile(new URL("app/teacher/transactions/page.tsx", root), "utf8"),
    readFile(new URL("app/admin/page.tsx", root), "utf8"),
    readFile(new URL("lib/payments/server.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentIdentityContext\(\)/);
  assert.match(factory, /resolveRole\(\) !== "teacher"/);
  assert.match(factory, /resolveRole\(\) !== "admin"/);
  assert.match(factory, /createAdminClient\(\), teacher\.id/);
  assert.match(postgres, /withAuthenticatedTransaction\(this\.userId/);
  assert.match(postgres, /withTrustedTransaction/);
  assert.match(postgres, /p\.teacher_id = \$1::uuid/);
  assert.match(postgres, /status = 'paid' and public\.is_admin\(\)/);
  assert.doesNotMatch(postgres, /select\s+\*/i);
  assert.doesNotMatch(factory + teacherPage + adminPage, /headers\(|cookies\(|request\.json|searchParams|teacherId\s*:|adminId\s*:|role\s*:/);
  assert.doesNotMatch(contracts, /phone|mpesa_ref|checkoutRequest|merchantRequest|provider_reference|external_request|lease|callback|content/i);
  assert.equal((payments.match(/\.from\("payments"\)\.select/g) ?? []).length, 0);
  assert.match(payments, /getPaymentAttemptReadRepository\(\)/);
  assert.doesNotMatch(payments, /payment-reporting/);
});
