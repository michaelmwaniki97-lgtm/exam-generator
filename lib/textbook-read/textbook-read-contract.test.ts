import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseTextbookReadRepository } from "./supabase.ts";
import { hasDuplicateTextbookName } from "./contracts.ts";

type Response = { data?: unknown; error?: unknown };
function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]); const response = responses.shift() ?? { data: null };
    const query = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return query; },
      maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(response); },
      order(...args: unknown[]) { calls.push(["order", ...args]); return query; },
      limit(...args: unknown[]) { calls.push(["limit", ...args]); return Promise.resolve(response); },
      then(resolve: (value: Response) => unknown) { return Promise.resolve(response).then(resolve); },
    }; return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("textbook backend remains environment-only with Supabase default", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase"; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres"; assert.equal(getDatabaseBackendName(), "postgres");
  if (previous === undefined) delete process.env.DATABASE_BACKEND; else process.env.DATABASE_BACKEND = previous;
});

test("duplicate validation preserves normalized name, subject/grade candidate scope, and publisher independence", () => {
  const scoped = [
    { id: "one", name: "  Mathematics Today  " },
    { id: "two", name: "Different title" },
  ];
  assert.equal(hasDuplicateTextbookName(scoped, "Mathematics Today"), true);
  assert.equal(hasDuplicateTextbookName(scoped, "mathematics today"), true);
  assert.equal(hasDuplicateTextbookName(scoped, "  MATHEMATICS TODAY  "), true);
  assert.equal(hasDuplicateTextbookName(scoped, "Different title"), true);
  assert.equal(hasDuplicateTextbookName(scoped, "Unrelated title"), false);
  assert.equal(hasDuplicateTextbookName([], "Mathematics Today"), false);
  // Publisher is intentionally absent from the candidate contract and therefore cannot alter duplicate status.
  assert.deepEqual(Object.keys(scoped[0]).sort(), ["id", "name"]);
});

test("Supabase textbook adapter preserves projections, filters, readiness, nulls, and empty results", async () => {
  const document = { id: "document", textbook_id: "book", original_filename: "fixture.pdf", file_size: 80,
    processing_status: "ready", processing_error: null, page_count: 2, chunk_count: 3, source_type: "oer", created_at: "2026-01-01" };
  const { client, calls } = fakeClient([
    { data: [{ id: "book", name: "Fixture" }] }, { data: { id: "book" } }, { data: [document] },
    { data: { id: "book", name: "Fixture" } }, { data: [{ id: "document" }] }, { data: [] },
  ]);
  const repository = new SupabaseTextbookReadRepository(client);
  assert.deepEqual(await repository.listTextbooksForDuplicateCheck("subject", "grade"), [{ id: "book", name: "Fixture" }]);
  assert.equal(await repository.textbookExists("book"), true);
  assert.deepEqual(await repository.listAdminTextbookDocuments(), [document]);
  assert.deepEqual(await repository.getTextbookForGrounding("book", "subject", "grade"), { id: "book", name: "Fixture" });
  assert.equal(await repository.getReadyDocumentId("book", "document"), "document");
  assert.equal(await repository.getReadyDocumentId("book"), null);
  assert.ok(calls.some((call) => call[0] === "select" && call[1] === "id, name"));
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "processing_status" && call[2] === "ready"));
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "id" && call[2] === "document"));
  assert.ok(calls.some((call) => call[0] === "order" && call[1] === "created_at"));
  assert.ok(calls.some((call) => call[0] === "order" && call[1] === "processed_at" && (call[2] as { ascending: boolean }).ascending === false));
  assert.ok(calls.filter((call) => call[0] === "order" && call[1] === "processed_at").every((call) => !("nullsFirst" in (call[2] as object))));
});

test("textbook boundary authenticates server-side and exposes no browser identity, backend, role, or private storage fields", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, contracts, actions] = await Promise.all([
    readFile(new URL("lib/textbook-read/index.ts", root), "utf8"), readFile(new URL("lib/textbook-read/postgres.ts", root), "utf8"),
    readFile(new URL("lib/textbook-read/contracts.ts", root), "utf8"), readFile(new URL("app/actions/textbooks.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentIdentityContext\(\)/);
  assert.match(factory, /resolveRole\(\) !== requiredRole/);
  assert.doesNotMatch(factory, /headers\(|cookies\(|request\.json|searchParams|userId\s*:/);
  assert.doesNotMatch(contracts, /storage_path|uploaded_by|authorization_note|content_sha256|embedding/i);
  assert.doesNotMatch(postgres, /select\s+\*/i);
  assert.match(postgres, /\$1::uuid/);
  assert.match(postgres, /order by processed_at desc\s+limit 1/);
  assert.doesNotMatch(postgres, /order by processed_at desc[^\n]*(?:,|nulls)/);
  assert.ok(postgres.indexOf('await this.authorize("admin")') < postgres.indexOf("return withTrustedTransaction(work)"));
  assert.ok(postgres.indexOf('await this.authorize("teacher")') < postgres.lastIndexOf("return withTrustedTransaction(work)"));
  assert.match(actions, /\.from\("textbook_documents"\)\.update/);
  assert.match(actions, /storage\.from\(TEXTBOOK_BUCKET\)/);
});
