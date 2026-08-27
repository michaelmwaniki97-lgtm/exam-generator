import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseCatalogWriteRepository } from "./supabase.ts";

type Response = { data?: unknown[] | null; error?: unknown };

function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]);
    const response = responses.shift() ?? { data: null };
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

test("catalog-write backend remains environment-only with Supabase default", () => {
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

test("Supabase catalog writes preserve fields, predicates, and delete returning semantics", async () => {
  const { client, calls } = fakeClient([
    {}, {}, { data: [{ id: "subject" }] }, {}, {}, { data: [] },
  ]);
  const repository = new SupabaseCatalogWriteRepository(client);
  await repository.createSubject("Science");
  await repository.updateSubject("subject", "Sciences");
  assert.equal(await repository.deleteSubject("subject"), true);
  await repository.createGrade("Form 1", "secondary");
  await repository.updateGrade("grade", "Form One", "secondary");
  assert.equal(await repository.deleteGrade("missing"), false);
  assert.deepEqual(calls, [
    ["from", "subjects"], ["insert", { name: "Science" }],
    ["from", "subjects"], ["update", { name: "Sciences" }], ["eq", "id", "subject"],
    ["from", "subjects"], ["delete"], ["eq", "id", "subject"], ["select", "id"],
    ["from", "grades"], ["insert", { name: "Form 1", level: "secondary" }],
    ["from", "grades"], ["update", { name: "Form One", level: "secondary" }], ["eq", "id", "grade"],
    ["from", "grades"], ["delete"], ["eq", "id", "missing"], ["select", "id"],
  ]);
});

test("Supabase catalog writes normalize database failures without leaking details", async () => {
  const { client } = fakeClient([{ error: { code: "23505", message: "private constraint detail" } }]);
  await assert.rejects(() => new SupabaseCatalogWriteRepository(client).createSubject("Duplicate"), /^Error: Catalog write failed\.$/);
});

test("catalog-write boundary preserves admin auth, validation, dependencies, and UI results", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, actions] = await Promise.all([
    readFile(new URL("lib/catalog-write/index.ts", root), "utf8"),
    readFile(new URL("lib/catalog-write/postgres.ts", root), "utf8"),
    readFile(new URL("app/actions/admin.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentUser\(\).*getUserRole\(\)/s);
  assert.match(factory, /isAdminRole\(role\)/);
  assert.match(factory, /PostgresCatalogWriteRepository\(user\.id\)/);
  assert.match(postgres, /withAuthenticatedTransaction/);
  assert.doesNotMatch(factory + postgres, /withTrustedTransaction|service_role|getPostgresPool|bypassrls/i);
  assert.doesNotMatch(postgres, /insert into public\.(?:subjects|grades)[^\n]*returning|update public\.(?:subjects|grades)[^\n]*returning/i);
  assert.match(postgres, /delete from public\.subjects where id = \$1::uuid returning id/);
  assert.match(postgres, /delete from public\.grades where id = \$1::uuid returning id/);
  assert.doesNotMatch(factory + actions, /userId\s*:|adminId\s*:|role\s*:|DATABASE_BACKEND\s*=/);
  assert.match(actions, /cleanRequiredText\(formData\.get\("name"\), "Subject name", 120\)/);
  assert.match(actions, /cleanRequiredText\(formData\.get\("name"\), "Grade or class name", 80\)/);
  assert.match(actions, /cleanRequiredText\(formData\.get\("level"\), "Education level", 80\)/);
  assert.match(actions, /getSubjectDependencies\(id\.value\)[\s\S]*dependencies\.curriculum[\s\S]*dependencies\.textbooks[\s\S]*dependencies\.exams/);
  assert.match(actions, /getGradeDependencies\(id\.value\)[\s\S]*dependencies\.curriculum[\s\S]*dependencies\.textbooks[\s\S]*dependencies\.exams/);
  assert.match(actions, /success\("Subject added\.".*"\/admin\/subjects"\)/s);
  assert.match(actions, /success\("Grade or class added\.".*"\/admin\/grades"\)/s);
  assert.doesNotMatch(actions, /\.from\("subjects"\)|\.from\("grades"\)/);
});
