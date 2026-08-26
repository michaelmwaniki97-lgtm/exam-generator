import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseCurriculumReadRepository } from "./supabase.ts";

type Response = { data?: unknown; count?: number | null; error?: unknown };
function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]);
    const response = responses.shift() ?? { data: [] };
    const query = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return query; },
      order(...args: unknown[]) { calls.push(["order", ...args]); return query; },
      in(...args: unknown[]) { calls.push(["in", ...args]); return Promise.resolve(response); },
      maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(response); },
      then(resolve: (value: Response) => unknown) { return Promise.resolve(response).then(resolve); },
    };
    return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("curriculum backend remains environment-only with Supabase default", () => {
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

test("Supabase adapter preserves scoped projections, filters, nested shapes, and empty selection", async () => {
  const subjectContext = { grade_id: "g1", subject_id: "s1", is_active: true, verification_status: "verified_official", subjects: { id: "s1", name: "Science" } };
  const hierarchy = [{ id: "st1", name: "Living things", sort_order: 2, source_code: null, source_ref: null, verification_status: "verified_official", is_active: true, sub_strands: [] }];
  const selection = [{ id: "ss1", name: "Plants", sort_order: 1, source_ref: null, verification_status: "verified_official", strands: { id: "st1", name: "Living things", sort_order: 2, subject_id: "s1", grade_id: "g1", is_active: true, source_ref: null, verification_status: "verified_official", strand_objectives: [] }, learning_outcomes: [{ description: "Observe plants", sort_order: 1 }] }];
  const admin = [{ id: "st1", name: "Living things", sort_order: 2, source_code: null, verification_status: "verified_official", outcome_status: "sourced", sub_strands: [], strand_objectives: [] }];
  const { client, calls } = fakeClient([
    { data: [{ grade_id: "g1" }, { grade_id: "g1" }] }, { data: [subjectContext] },
    { data: hierarchy }, { data: selection }, { data: admin },
  ]);
  const repository = new SupabaseCurriculumReadRepository(client);
  assert.deepEqual(await repository.listActiveGradeIds(), ["g1", "g1"]);
  assert.deepEqual(await repository.listSubjectContextsForGrade("g1"), [{
    grade_id: "g1", subject_id: "s1", is_active: true,
    verification_status: "verified_official", subject: { id: "s1", name: "Science" },
  }]);
  assert.deepEqual(await repository.listActiveHierarchy("g1", "s1"), hierarchy);
  assert.deepEqual(await repository.getSelectionTopics(["ss1"]), selection);
  assert.deepEqual(await repository.getSelectionTopics([]), []);
  assert.deepEqual(await repository.listAdminHierarchy("g1", "s1"), admin);
  assert.ok(calls.some((call) => call[0] === "in" && call[1] === "id"));
  assert.ok(calls.filter((call) => call[0] === "eq").some((call) => call[1] === "is_active" && call[2] === true));
});

test("Supabase adapter preserves validation lookup, parent, count, and empty contracts", async () => {
  const { client } = fakeClient([
    { count: 2 }, { count: 3 }, { data: [{ id: "st", name: "Topic" }] },
    { data: { id: "st", grade_id: "g", subject_id: "s" } }, { count: 4 },
    { data: [{ id: "ss", name: "Subtopic" }] }, { data: { id: "ss", strand_id: "st" } },
    { count: 5 }, { data: [{ id: "lo", description: "Outcome" }] },
    { data: { id: "lo", sub_strand_id: "ss" } }, { data: null }, { data: null },
  ]);
  const repository = new SupabaseCurriculumReadRepository(client);
  assert.equal(await repository.countStrandsBySubject("s"), 2);
  assert.equal(await repository.countStrandsByGrade("g"), 3);
  assert.deepEqual(await repository.listStrandNames("g", "s"), [{ id: "st", name: "Topic" }]);
  assert.deepEqual(await repository.getStrandParent("st"), { id: "st", grade_id: "g", subject_id: "s" });
  assert.equal(await repository.countSubStrands("st"), 4);
  assert.deepEqual(await repository.listSubStrandNames("st"), [{ id: "ss", name: "Subtopic" }]);
  assert.deepEqual(await repository.getSubStrandParent("ss"), { id: "ss", parent_id: "st" });
  assert.equal(await repository.countLearningOutcomes("ss"), 5);
  assert.deepEqual(await repository.listLearningOutcomeDescriptions("ss"), [{ id: "lo", description: "Outcome" }]);
  assert.deepEqual(await repository.getLearningOutcomeParent("lo"), { id: "lo", parent_id: "ss" });
  assert.equal(await repository.getSubStrandParent("missing"), null);
  assert.equal(await repository.getLearningOutcomeParent("missing"), null);
});

test("curriculum boundary is server-only and accepts no caller identity, role, or backend", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, actions, postgres, wizard] = await Promise.all([
    readFile(new URL("lib/curriculum-read/index.ts", root), "utf8"),
    readFile(new URL("app/actions/curriculum.ts", root), "utf8"),
    readFile(new URL("lib/curriculum-read/postgres.ts", root), "utf8"),
    readFile(new URL("components/exam-wizard/exam-wizard.tsx", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /auth\.getUser\(\)/);
  assert.match(factory, /PostgresCurriculumReadRepository\(user\.id\)/);
  assert.match(actions, /^"use server";/);
  assert.match(actions, /UUID_PATTERN\.test\(gradeId\)/);
  assert.doesNotMatch(factory + actions, /headers\(|cookies\(|userId\s*:|role\s*:/);
  assert.doesNotMatch(factory + actions + postgres, /service_role|getTrustedRpcDatabase|bypassrls/i);
  assert.doesNotMatch(wizard, /supabase\/client|DATABASE_URL|PostgresCurriculumReadRepository/);
});
