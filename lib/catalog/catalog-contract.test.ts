import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseCatalogRepository } from "./supabase.ts";

type Response = { data?: unknown; count?: number | null; error?: unknown };

function clientWith(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      const response = responses.shift() ?? { data: [] };
      const builder = {
        select(...args: unknown[]) { calls.push(["select", ...args]); return builder; },
        order(...args: unknown[]) { calls.push(["order", ...args]); return builder; },
        eq(...args: unknown[]) { calls.push(["eq", ...args]); return builder; },
        maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(response); },
        then(resolve: (value: Response) => unknown) { return Promise.resolve(response).then(resolve); },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("catalog selection remains environment-only and defaults to Supabase", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND;
  assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres";
  assert.equal(getDatabaseBackendName(), "postgres");
  process.env.DATABASE_BACKEND = "browser-choice";
  assert.throws(() => getDatabaseBackendName(), /supabase or postgres/);
  if (previous === undefined) delete process.env.DATABASE_BACKEND;
  else process.env.DATABASE_BACKEND = previous;
});

test("Supabase catalog preserves projections, null normalization, and ordering", async () => {
  const { client, calls } = clientWith([
    { data: [{ id: "g", name: "Grade", level: "primary", sort_order: null }] },
    { data: [{ id: "s", name: "Subject" }] },
    { count: 4, data: null },
  ]);
  const catalog = new SupabaseCatalogRepository(client);
  assert.deepEqual(await catalog.listWizardGrades(), [{ id: "g", name: "Grade", level: "primary", sort_order: 0 }]);
  assert.deepEqual(await catalog.listSubjectsByName(), [{ id: "s", name: "Subject" }]);
  assert.equal(await catalog.countSubjects(), 4);
  assert.deepEqual(calls, [
    ["from", "grades"], ["select", "id, name, level, sort_order"], ["order", "sort_order"], ["order", "created_at"],
    ["from", "subjects"], ["select", "id, name"], ["order", "name"],
    ["from", "subjects"], ["select", "id", { count: "exact", head: true }],
  ]);
});

test("Supabase catalog normalizes every scoped list, lookup, existence, and empty contract", async () => {
  const grade = { id: "g", name: "Grade", level: "primary" };
  const option = { id: "s", name: "Subject" };
  const { client } = clientWith([
    { data: [grade] }, { data: [{ id: "g", name: "Grade" }] }, { data: [{ id: "g", name: "Grade" }] },
    { data: grade }, { data: { id: "g" } }, { data: [option] }, { data: option }, { data: { id: "s" } },
    { data: null }, { data: null }, { data: null }, { data: null },
  ]);
  const catalog = new SupabaseCatalogRepository(client);
  assert.deepEqual(await catalog.listGradesByCreation(), [grade]);
  assert.deepEqual(await catalog.listGradeOptionsByName(), [{ id: "g", name: "Grade" }]);
  assert.deepEqual(await catalog.listGradeNames(), [{ id: "g", name: "Grade" }]);
  assert.deepEqual(await catalog.getGradeById("g"), grade);
  assert.equal(await catalog.gradeExists("g"), true);
  assert.deepEqual(await catalog.listSubjectNames(), [option]);
  assert.deepEqual(await catalog.getSubjectById("s"), option);
  assert.equal(await catalog.subjectExists("s"), true);
  assert.equal(await catalog.getGradeById("missing"), null);
  assert.equal(await catalog.gradeExists("missing"), false);
  assert.equal(await catalog.getSubjectById("missing"), null);
  assert.equal(await catalog.subjectExists("missing"), false);
});

test("catalog boundary is authenticated, server-only, and accepts no browser identity or role", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, action, postgres] = await Promise.all([
    readFile(new URL("lib/catalog/index.ts", root), "utf8"),
    readFile(new URL("app/actions/catalog.ts", root), "utf8"),
    readFile(new URL("lib/catalog/postgres.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /supabase\.auth\.getUser\(\)/);
  assert.match(factory, /new PostgresCatalogRepository\(user\.id\)/);
  assert.match(factory, /function getCatalogRepository\(\)/);
  assert.doesNotMatch(factory + action, /request|headers\(|cookies\(|userId\s*:/);
  assert.doesNotMatch(factory + action + postgres, /getTrustedRpcDatabase|service_role|bypassrls/i);
  assert.match(action, /^"use server";/);
});
