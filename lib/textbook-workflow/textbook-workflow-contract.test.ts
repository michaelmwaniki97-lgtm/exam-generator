import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SupabaseTextbookWorkflowRepository } from "./supabase.ts";

function mockClient() {
  const calls: Array<{ table: string; operation?: string; payload?: unknown; select?: string; predicate?: unknown }> = [];
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    chain.insert = async (payload: unknown) => { calls.push({ table, operation: "insert", payload }); return { error: null }; };
    chain.update = (payload: unknown) => { calls.push({ table, operation: "update", payload }); return chain; };
    chain.delete = () => { calls.push({ table, operation: "delete" }); return chain; };
    chain.select = (projection: string) => { calls.push({ table, select: projection }); return chain; };
    chain.eq = (column: string, value: unknown) => { calls.push({ table, predicate: [column, value] }); return chain; };
    chain.maybeSingle = async () => ({ data: null, error: null });
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [{ id: "x" }], error: null });
    return chain;
  };
  return { client: { from } as never, calls };
}

test("Supabase workflow preserves explicit tables, projections, mutations, and delete existence", async () => {
  const { client, calls } = mockClient(); const repository = new SupabaseTextbookWorkflowRepository(client);
  assert.equal(await repository.createTextbook({ name: "Book", publisher: null, subject_id: "s", grade_id: "g" }), true);
  assert.equal(await repository.createDocument({ id: "d", textbook_id: "t", storage_path: "textbooks/t/d/book.pdf",
    original_filename: "book.pdf", mime_type: "application/pdf", file_size: 10, content_sha256: "a".repeat(64),
    source_type: "oer", authorization_note: null, authorization_acknowledged: true, uploaded_by: "u" }), "created");
  await repository.getDocumentForProcessing("d"); await repository.markProcessing("d", "2026-01-01T00:00:00Z");
  await repository.replaceChunksAndMarkReady("d", [], { page_count: 1, extracted_character_count: 10, chunk_count: 0,
    embedding_model: "model", embedding_dimension: 2048, processed_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" });
  await repository.clearChunksAndMarkFailed("d", "failure", "2026-01-01T00:00:00Z");
  await repository.getDocumentForRemoval("d"); assert.equal(await repository.deleteDocument("d"), true);
  assert.ok(calls.some((call) => call.table === "textbooks" && call.operation === "insert"));
  assert.ok(calls.some((call) => call.select === "id, textbook_id, storage_path, processing_status"));
  assert.ok(calls.some((call) => call.select === "id, storage_path, processing_status"));
  assert.ok(calls.every((call) => call.select !== "*"));
});

test("architecture keeps admin/trusted boundary, provider keys, and direct calls out of actions", async () => {
  const [actions, index, postgres, storage] = await Promise.all([
    readFile(new URL("../../app/actions/textbooks.ts", import.meta.url), "utf8"),
    readFile(new URL("./index.ts", import.meta.url), "utf8"),
    readFile(new URL("./postgres.ts", import.meta.url), "utf8"),
    readFile(new URL("../textbook-storage/filesystem.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(actions, /\.from\("(?:textbooks|textbook_documents|textbook_chunks)"\)|\.storage\.from/);
  assert.match(index, /resolveRole\(\) !== "admin"/);
  assert.match(postgres, /withTrustedTransaction/); assert.doesNotMatch(postgres, /select \*/i);
  assert.match(storage, /startsWith/); assert.match(storage, /0o600/);
});
