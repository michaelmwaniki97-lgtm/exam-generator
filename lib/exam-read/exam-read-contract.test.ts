import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseExamReadRepository } from "./supabase.ts";

type Response = { data?: unknown; error?: unknown };
function clientWith(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]); const response = responses.shift() ?? { data: [] };
    const builder = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return builder; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return builder; },
      order(...args: unknown[]) { calls.push(["order", ...args]); return builder; },
      limit(...args: unknown[]) { calls.push(["limit", ...args]); return Promise.resolve(response); },
      maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(response); },
      then(resolve: (value: Response) => unknown) { return Promise.resolve(response).then(resolve); },
    }; return builder;
  } };
  return { client: client as unknown as SupabaseClient, calls };
}

test("exam reads remain environment-selected and default to Supabase", () => {
  const before = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase"; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres"; assert.equal(getDatabaseBackendName(), "postgres");
  if (before === undefined) delete process.env.DATABASE_BACKEND; else process.env.DATABASE_BACKEND = before;
});

test("Supabase adapter preserves projections, ownership, ordering, limits, nulls, and missing rows", async () => {
  const recent = { id: "a", exam_type: "CAT", status: "draft", created_at: "2026-01-02", subjects: null, grades: { name: "Grade" } };
  const list = { ...recent, marks: 20, duration: 30, difficulty: "medium", term: null, year: null };
  const editing = { id: "a", teacher_id: "teacher-a", subject_id: "s", grade_id: "g", exam_type: "CAT", difficulty: "medium", status: "draft", revision: 2, content: {}, marking_schemes: [{ content: {} }] };
  const { client, calls } = clientWith([{ data: [recent] }, { data: [list] }, { data: editing }, { data: null }]);
  const repository = new SupabaseExamReadRepository(client, "teacher-a");
  assert.deepEqual(await repository.listRecentTeacherExams(5), [recent]);
  assert.deepEqual(await repository.listTeacherExams(), [list]);
  assert.deepEqual(await repository.getTeacherExamForEditing("a"), editing);
  assert.equal(await repository.getTeacherExamForEditing("missing"), null);
  assert.equal(calls.filter((call) => call[0] === "eq" && call[1] === "teacher_id" && call[2] === "teacher-a").length, 4);
  assert.ok(calls.some((call) => call[0] === "limit" && call[1] === 5));
  assert.equal(calls.filter((call) => call[0] === "order" && call[1] === "created_at").length, 2);
});

test("exam repository boundary is server-only and accepts no browser identity, backend, or role", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, dashboard, history, identityFactory, identitySupabase] = await Promise.all([
    readFile(new URL("lib/exam-read/index.ts", root), "utf8"), readFile(new URL("lib/exam-read/postgres.ts", root), "utf8"),
    readFile(new URL("app/teacher/dashboard/page.tsx", root), "utf8"), readFile(new URL("app/teacher/exams/page.tsx", root), "utf8"),
    readFile(new URL("lib/identity-read/index.ts", root), "utf8"), readFile(new URL("lib/identity-read/supabase.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /supabase\.auth\.getUser\(\)/);
  assert.match(factory, /getIdentityReadRepository\(\).*getTeacherIdentity\(\)/s);
  assert.match(identityFactory, /supabase\.auth\.getUser\(\)/);
  assert.match(identitySupabase, /\.eq\("user_id", this\.userId\)/);
  assert.match(factory, /new PostgresExamReadRepository\(user\.id, teacher\.id\)/);
  assert.doesNotMatch(factory + identityFactory + dashboard + history, /headers\(|cookies\(|request\.json|searchParams.*DATABASE_BACKEND|user_id\s*:/);
  assert.doesNotMatch(factory + postgres, /service_role|withTrustedTransaction|set role|bypassrls/i);
  assert.doesNotMatch(postgres, /select\s+\*/i);
  assert.match(postgres, /where e\.teacher_id = \$1::uuid/);
});
