import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabasePaymentEntitlementReadRepository } from "./supabase.ts";

type Response = { data?: unknown; error?: unknown };

function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]); const response = responses.shift() ?? { data: [] };
    const query = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return query; },
      limit(...args: unknown[]) { calls.push(["limit", ...args]); return Promise.resolve(response); },
    };
    return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("payment entitlement backend remains environment-only with Supabase default", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase"; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres"; assert.equal(getDatabaseBackendName(), "postgres");
  process.env.DATABASE_BACKEND = "browser"; assert.throws(() => getDatabaseBackendName(), /supabase or postgres/);
  if (previous === undefined) delete process.env.DATABASE_BACKEND; else process.env.DATABASE_BACKEND = previous;
});

test("Supabase entitlement preserves historical paid-row existence contract", async () => {
  const { client, calls } = fakeClient([{ data: [{ id: "paid" }] }, { data: [] }, { data: null, error: { message: "fixture" } }]);
  const repository = new SupabasePaymentEntitlementReadRepository(client, "teacher-a");
  assert.equal(await repository.hasSuccessfulPaymentForExam("exam-a"), true);
  assert.equal(await repository.hasSuccessfulPaymentForExam("exam-unpaid"), false);
  assert.equal(await repository.hasSuccessfulPaymentForExam("exam-error"), false);
  assert.deepEqual(calls.slice(0, 6), [
    ["from", "payments"], ["select", "id"], ["eq", "exam_id", "exam-a"],
    ["eq", "teacher_id", "teacher-a"], ["eq", "status", "paid"], ["limit", 1],
  ]);
  assert.equal(calls.filter((call) => call[0] === "eq" && call[1] === "status" && call[2] === "paid").length, 3);
  assert.ok(!calls.some((call) => ["provider", "verification_status", "amount", "currency", "mpesa_ref", "provider_reference"].includes(String(call[1]))));
});

test("entitlement is a server-only authorization boundary separate from reporting and Phase 10C", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, supabase, paymentServer, reporting, loader] = await Promise.all([
    readFile(new URL("lib/payment-entitlement/index.ts", root), "utf8"),
    readFile(new URL("lib/payment-entitlement/postgres.ts", root), "utf8"),
    readFile(new URL("lib/payment-entitlement/supabase.ts", root), "utf8"),
    readFile(new URL("lib/payments/server.ts", root), "utf8"),
    readFile(new URL("lib/payment-reporting/index.ts", root), "utf8"),
    readFile(new URL("lib/exam-document/load.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentIdentityContext\(\)/);
  assert.match(factory, /resolveRole\(\) !== "teacher"/);
  assert.match(factory, /getTeacherIdentity\(\)/);
  assert.doesNotMatch(factory, /headers\(|cookies\(|request\.json|searchParams|teacherId\s*:/);
  assert.match(postgres, /withAuthenticatedTransaction/);
  assert.match(postgres, /exam_id = \$1::uuid and teacher_id = \$2::uuid and status = 'paid'/);
  assert.match(postgres, /not public\.is_admin\(\)/);
  assert.doesNotMatch(postgres, /withTrustedTransaction|service_role|select\s+\*/i);
  assert.doesNotMatch(postgres + supabase, /provider\s*=|mpesa_ref|provider_reference|verification_status|external_request|receipt/i);
  assert.match(paymentServer, /hasSuccessfulPaymentForExam\(examId\)/);
  assert.match(paymentServer, /hasSuccessfulPayment \|\| exam\.status === "paid" \|\| exam\.status === "downloaded"/);
  assert.equal((paymentServer.match(/\.from\("payments"\)\.select/g) ?? []).length, 0);
  assert.match(paymentServer, /getPaymentAttemptReadRepository\(\)/);
  assert.doesNotMatch(reporting, /payment-entitlement/);
  assert.ok(loader.indexOf("getDocumentAccessMetadata(id)") < loader.indexOf("getExamDownloadEntitlement(id)"));
  assert.ok(loader.indexOf("getExamDownloadEntitlement(id)") < loader.indexOf("getAuthorizedExamDocument(id"));
});
