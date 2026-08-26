import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseAdminReportingRepository } from "./supabase.ts";

type Response = { data?: unknown; count?: number | null; error?: unknown };

function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]);
    const response = responses.shift() ?? { data: [] };
    const query = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return Promise.resolve(response); },
      contains(...args: unknown[]) { calls.push(["contains", ...args]); return Promise.resolve(response); },
      order(...args: unknown[]) { calls.push(["order", ...args]); return Promise.resolve(response); },
      then(resolve: (value: Response) => unknown) { return Promise.resolve(response).then(resolve); },
    };
    return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("admin reporting backend remains environment-only with Supabase default", () => {
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

test("Supabase admin reporting preserves exact counts, filters, zeroes, and metadata shape", async () => {
  const book = { id: "book", name: "Book", publisher: null, subject: { name: "Science" }, grade: { name: "Grade 1" } };
  const { client, calls } = fakeClient([
    { count: 7 },
    { count: 2 }, { count: 3 }, { count: 4 },
    { count: null }, { count: 0 }, { count: 1 },
    { count: 5 },
    { data: [book] },
  ]);
  const repository = new SupabaseAdminReportingRepository(client);
  assert.equal(await repository.countDashboardExams(), 7);
  assert.deepEqual(await repository.getSubjectDependencies("subject"), { curriculum: 2, textbooks: 3, exams: 4 });
  assert.deepEqual(await repository.getGradeDependencies("grade"), { curriculum: 0, textbooks: 0, exams: 1 });
  assert.equal(await repository.countExamsReferencingSubStrand("topic"), 5);
  assert.deepEqual(await repository.listTextbookMetadata(), [book]);
  assert.ok(calls.some((call) => call[0] === "contains" && call[1] === "content" &&
    JSON.stringify(call[2]) === JSON.stringify({ meta: { topicIds: ["topic"] } })));
  assert.ok(calls.some((call) => call[0] === "select" && call[1] === "id, name, publisher, subject:subjects(name), grade:grades(name)"));
  assert.equal(calls.filter((call) => call[0] === "select" && (call[2] as { count?: string })?.count === "exact").length, 8);
});

test("admin reporting boundary is server-only, reauthorizes admin, and accepts no caller authority", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, actions, dashboard] = await Promise.all([
    readFile(new URL("lib/admin-reporting/index.ts", root), "utf8"),
    readFile(new URL("lib/admin-reporting/postgres.ts", root), "utf8"),
    readFile(new URL("app/actions/admin.ts", root), "utf8"),
    readFile(new URL("app/admin/page.tsx", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentUser\(\).*getUserRole\(\)/s);
  assert.match(factory, /isAdminRole\(role\)/);
  assert.match(factory, /PostgresAdminReportingRepository\(user\.id\)/);
  assert.match(postgres, /^import "server-only";/);
  assert.match(postgres, /withAuthenticatedTransaction/);
  assert.match(postgres, /public\.is_admin\(\)/);
  assert.doesNotMatch(factory + actions + dashboard, /headers\(|cookies\(|adminId\s*:|userId\s*:|role\s*:/);
  assert.doesNotMatch(factory + postgres, /withTrustedTransaction|service_role|bypassrls|getPostgresPool/);
  assert.doesNotMatch(dashboard, /exam\.content|marking_schemes|mpesa|provider_reference/i);
});
