import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseCurriculumWriteRepository } from "./supabase.ts";

type Response = { data?: unknown[] | null; error?: { code?: string } | null };

function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]);
    const response = responses.shift() ?? { data: null, error: null };
    const query = {
      insert(...args: unknown[]) { calls.push(["insert", ...args]); return Promise.resolve(response); },
      update(...args: unknown[]) { calls.push(["update", ...args]); return query; },
      delete(...args: unknown[]) { calls.push(["delete", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return query; },
      select(...args: unknown[]) { calls.push(["select", ...args]); return Promise.resolve(response); },
      then(resolve: (value: Response) => unknown) { return Promise.resolve(response).then(resolve); },
    };
    return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("curriculum-write backend is environment-only with Supabase default", () => {
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

test("Supabase curriculum writes preserve exact fields, predicates, and returning", async () => {
  const { client, calls } = fakeClient([
    {}, {}, { data: [{ id: "strand" }] }, {}, {}, { data: [] }, {}, {}, { data: [{ id: "outcome" }] },
  ]);
  const repository = new SupabaseCurriculumWriteRepository(client);
  await repository.createStrand("grade", "subject", "Numbers");
  await repository.updateStrand("strand", "Number concepts");
  assert.equal(await repository.deleteStrand("strand"), true);
  await repository.createSubStrand("strand", "Counting");
  await repository.updateSubStrand("sub", "Counting objects");
  assert.equal(await repository.deleteSubStrand("missing"), false);
  await repository.createLearningOutcome("sub", "Count objects");
  await repository.updateLearningOutcome("outcome", "Count ten objects");
  assert.equal(await repository.deleteLearningOutcome("outcome"), true);
  assert.deepEqual(calls, [
    ["from", "strands"], ["insert", { grade_id: "grade", subject_id: "subject", name: "Numbers" }],
    ["from", "strands"], ["update", { name: "Number concepts", source_code: null, verification_status: "unverified", outcome_status: "unverified", source_ref: null, source_metadata: {} }], ["eq", "id", "strand"],
    ["from", "strands"], ["delete"], ["eq", "id", "strand"], ["select", "id"],
    ["from", "sub_strands"], ["insert", { strand_id: "strand", name: "Counting" }],
    ["from", "sub_strands"], ["update", { name: "Counting objects", source_code: null, verification_status: "unverified", outcome_status: "unverified", source_ref: null, source_metadata: {} }], ["eq", "id", "sub"],
    ["from", "sub_strands"], ["delete"], ["eq", "id", "missing"], ["select", "id"],
    ["from", "learning_outcomes"], ["insert", { sub_strand_id: "sub", description: "Count objects" }],
    ["from", "learning_outcomes"], ["update", { description: "Count ten objects", verification_status: "unverified", source_ref: null, source_metadata: {} }], ["eq", "id", "outcome"],
    ["from", "learning_outcomes"], ["delete"], ["eq", "id", "outcome"], ["select", "id"],
  ]);
});

test("Supabase legacy schema update fallbacks preserve name/description-only behavior", async () => {
  const pgrst204 = { error: { code: "PGRST204" } };
  const { client, calls } = fakeClient([pgrst204, {}, pgrst204, {}, pgrst204, {}]);
  const repository = new SupabaseCurriculumWriteRepository(client);
  await repository.updateStrand("strand", "Legacy strand");
  await repository.updateSubStrand("sub", "Legacy sub");
  await repository.updateLearningOutcome("outcome", "Legacy outcome");
  assert.deepEqual(calls.filter(([operation]) => operation === "update"), [
    ["update", { name: "Legacy strand", source_code: null, verification_status: "unverified", outcome_status: "unverified", source_ref: null, source_metadata: {} }],
    ["update", { name: "Legacy strand" }],
    ["update", { name: "Legacy sub", source_code: null, verification_status: "unverified", outcome_status: "unverified", source_ref: null, source_metadata: {} }],
    ["update", { name: "Legacy sub" }],
    ["update", { description: "Legacy outcome", verification_status: "unverified", source_ref: null, source_metadata: {} }],
    ["update", { description: "Legacy outcome" }],
  ]);
});

test("Supabase curriculum writes sanitize database failures", async () => {
  const { client } = fakeClient([{ error: { code: "23505" } }]);
  await assert.rejects(
    () => new SupabaseCurriculumWriteRepository(client).createStrand("grade", "subject", "Duplicate"),
    /^Error: Curriculum write failed\.$/
  );
});

test("curriculum-write boundary preserves admin auth and surrounding application checks", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, actions] = await Promise.all([
    readFile(new URL("lib/curriculum-write/index.ts", root), "utf8"),
    readFile(new URL("lib/curriculum-write/postgres.ts", root), "utf8"),
    readFile(new URL("app/actions/admin.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentUser\(\).*getUserRole\(\)/s);
  assert.match(factory, /isAdminRole\(role\)/);
  assert.match(factory, /PostgresCurriculumWriteRepository\(user\.id\)/);
  assert.match(postgres, /withAuthenticatedTransaction/);
  assert.doesNotMatch(factory + postgres, /withTrustedTransaction|service_role|getPostgresPool|bypassrls/i);
  assert.doesNotMatch(postgres, /returning \*/i);
  assert.doesNotMatch(actions, /\.from\("(?:strands|sub_strands|learning_outcomes)"\)/);
  assert.match(actions, /countSubStrands\(id\.value\)/);
  assert.match(actions, /countLearningOutcomes\(id\.value\)/);
  assert.match(actions, /countExamsReferencingSubStrand\(id\.value\)/);
  assert.match(actions, /cleanRequiredText\(formData\.get\("name"\), "Strand or topic name", 180\)/);
  assert.match(actions, /cleanRequiredMultiline[\s\S]*"Learning outcome or objective",[\s\S]*1000/);
  assert.doesNotMatch(factory + actions, /userId\s*:|adminId\s*:|role\s*:|DATABASE_BACKEND\s*=/);
});
