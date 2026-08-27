import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresTextbookWorkflowRepository } from "./postgres.ts";

test("PostgreSQL textbook workflow preserves document state, chunks, provenance, and deletion", async (context) => {
  const textbookId = randomUUID(), documentId = randomUUID();
  const repository = new PostgresTextbookWorkflowRepository();
  context.after(async () => { try { await withTrustedTransaction(async (client) => {
    await client.query("delete from public.textbook_documents where id=$1::uuid", [documentId]);
    await client.query("delete from public.textbooks where id=$1::uuid", [textbookId]);
  }); } finally { await closePostgresPool(); } });
  const created = "00000000-0000-4000-8000-000000000005";
  assert.equal(await repository.createTextbook({ name: `Synthetic ${textbookId}`, publisher: null,
    subject_id: "10000000-0000-4000-8000-000000000001", grade_id: "10000000-0000-4000-8000-000000000002" }), true);
  // createTextbook generates its own ID, so use a fixed fixture for linkage and remove the generated synthetic by name.
  await withTrustedTransaction(async (client) => {
    await client.query("delete from public.textbooks where name=$1", [`Synthetic ${textbookId}`]);
    await client.query(`insert into public.textbooks (id,name,subject_id,grade_id) values ($1::uuid,$2,$3::uuid,$4::uuid)`,
      [textbookId, `Workflow ${textbookId}`, "10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"]);
  });
  assert.equal(await repository.createDocument({ id: documentId, textbook_id: textbookId,
    storage_path: `textbooks/${textbookId}/${documentId}/fixture.pdf`, original_filename: "fixture.pdf", mime_type: "application/pdf",
    file_size: 10, content_sha256: "a".repeat(64), source_type: "school_supplied", authorization_note: null,
    authorization_acknowledged: true, uploaded_by: created }), "created");
  assert.equal((await repository.getDocumentForProcessing(documentId))?.processing_status, "uploaded");
  await repository.markProcessing(documentId, "2026-08-27T10:00:00Z");
  assert.equal((await repository.getDocumentForProcessing(documentId))?.processing_status, "processing");
  const vector = `[${Array.from({ length: 2048 }, (_, index) => index === 0 ? 1 : 0).join(",")}]`;
  await repository.replaceChunksAndMarkReady(documentId, [{ document_id: documentId, textbook_id: textbookId, chunk_index: 0,
    page_start: 1, page_end: 1, text: "Synthetic public-domain fixture content for indexing verification.", character_count: 66,
    metadata: { pageStart: 1, pageEnd: 1 }, embedding: vector }], {
    page_count: 1, extracted_character_count: 66, chunk_count: 1, embedding_model: "nvidia/nemotron-3-embed-1b",
    embedding_dimension: 2048, processed_at: "2026-08-27T10:01:00Z", updated_at: "2026-08-27T10:01:00Z",
  });
  const ready = await withTrustedTransaction(async (client) => (await queryRows<{ processing_status: string; chunk_count: number; embedding_dimension: number; chunks: number }>(client,
    `select d.processing_status,d.chunk_count,d.embedding_dimension,(select count(*)::int from public.textbook_chunks c where c.document_id=d.id) chunks
     from public.textbook_documents d where d.id=$1::uuid`, [documentId]))[0]);
  assert.deepEqual(ready, { processing_status: "ready", chunk_count: 1, embedding_dimension: 2048, chunks: 1 });
  await repository.clearChunksAndMarkFailed(documentId, "Synthetic failure", "2026-08-27T10:02:00Z");
  assert.equal((await repository.getDocumentForProcessing(documentId))?.processing_status, "failed");
  assert.equal((await repository.getDocumentForRemoval(documentId))?.storage_path.endsWith("fixture.pdf"), true);
  assert.equal(await repository.deleteDocument(documentId), true);
  assert.equal(await repository.getDocumentForRemoval(documentId), null);
});
