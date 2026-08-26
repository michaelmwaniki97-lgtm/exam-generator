import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseExamReadRepository } from "./supabase.ts";

type Response = { data?: unknown; error?: unknown };
function clientWith(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]); const response = responses.shift() ?? { data: null };
    const builder = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return builder; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return builder; },
      maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(response); },
    }; return builder;
  } };
  return { client: client as unknown as SupabaseClient, calls };
}

test("Supabase document adapter separates metadata from private student and marking projections", async () => {
  const metadata = { id: "exam-a", status: "generated", revision: 3 };
  const base = { id: "exam-a", exam_type: "CAT", marks: 20, duration: 30, term: "Term 1", year: null, content: { synthetic: true }, teachers: { school: null } };
  const { client, calls } = clientWith([{ data: metadata }, { data: base }, { data: { ...base, marking_schemes: [{ content: { marking: true } }] } }, { data: null }]);
  const repository = new SupabaseExamReadRepository(client, "teacher-a", "teacher");
  assert.deepEqual(await repository.getDocumentAccessMetadata("exam-a"), metadata);
  assert.deepEqual((await repository.getAuthorizedExamDocument("exam-a", false))?.marking_schemes, []);
  assert.equal((await repository.getAuthorizedExamDocument("exam-a", true))?.marking_schemes.length, 1);
  assert.equal(await repository.getDocumentAccessMetadata("missing"), null);
  assert.equal(calls.filter((call) => call[0] === "eq" && call[1] === "teacher_id" && call[2] === "teacher-a").length, 4);
  const projections = calls.filter((call) => call[0] === "select").map((call) => String(call[1]));
  assert.equal(projections[0], "id, status, revision");
  assert.equal(projections[0].includes("content"), false);
  assert.equal(projections[1].includes("marking_schemes"), false);
  assert.equal(projections[2].includes("marking_schemes(content)"), true);
});

test("admin document contract uses session RLS without a browser-selected ownership bypass", async () => {
  const { client, calls } = clientWith([{ data: { id: "exam-a", status: "draft", revision: 1 } }, { data: null }]);
  const repository = new SupabaseExamReadRepository(client, null, "admin");
  assert.ok(await repository.getDocumentAccessMetadata("exam-a"));
  assert.equal(await repository.getAuthorizedExamDocument("missing", false), null);
  assert.equal(calls.some((call) => call[0] === "eq" && call[1] === "teacher_id"), false);
});

test("document loader authorizes metadata, gates paid PDFs, then loads private content", async () => {
  const root = new URL("../../", import.meta.url);
  const [loader, route, factory, postgres] = await Promise.all([
    readFile(new URL("lib/exam-document/load.ts", root), "utf8"), readFile(new URL("app/api/exams/[id]/pdf/route.ts", root), "utf8"),
    readFile(new URL("lib/exam-read/index.ts", root), "utf8"), readFile(new URL("lib/exam-read/postgres.ts", root), "utf8"),
  ]);
  const metadata = loader.indexOf("getDocumentAccessMetadata(id)");
  const entitlement = loader.indexOf("getExamDownloadEntitlement(id)");
  const privateLoad = loader.indexOf("getAuthorizedExamDocument(id");
  assert.ok(metadata >= 0 && metadata < entitlement && entitlement < privateLoad);
  assert.match(route, /loadCanonicalExamDocument\(id, kind, \{ requirePaid: true \}\)/);
  assert.match(route, /private, no-store, max-age=0/);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /supabase\.auth\.getUser\(\)/);
  assert.match(factory, /function getExamDocumentReadContext\(\)/);
  assert.doesNotMatch(factory + loader, /request\.json|headers\(|cookies\(|userId\s*:/);
  assert.doesNotMatch(postgres, /select\s+\*/i);
  const authenticatedPostgres = postgres.slice(postgres.indexOf("export class PostgresExamReadRepository"), postgres.indexOf("export class PostgresTrustedExamReadRepository"));
  assert.doesNotMatch(authenticatedPostgres, /withTrustedTransaction|service_role|bypassrls|set role/i);
});
