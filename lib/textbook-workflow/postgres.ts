import "server-only";
import { queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import type { ReadyMetadata, RemovalDocument, ProcessingDocument, TextbookDocumentInsert, TextbookChunkInsert, TextbookWorkflowRepository } from "./contracts.ts";

export class PostgresTextbookWorkflowRepository implements TextbookWorkflowRepository {
  async createTextbook(input: { name: string; publisher: string | null; subject_id: string; grade_id: string }) {
    try { return await withTrustedTransaction(async (client) => (await client.query(
      `insert into public.textbooks (name, publisher, subject_id, grade_id) values ($1, $2, $3::uuid, $4::uuid) returning id`,
      [input.name, input.publisher, input.subject_id, input.grade_id])).rowCount === 1); } catch { return false; }
  }
  async createDocument(input: TextbookDocumentInsert) {
    try {
      await withTrustedTransaction((client) => client.query(
        `insert into public.textbook_documents
          (id, textbook_id, storage_path, original_filename, mime_type, file_size, content_sha256, source_type,
           authorization_note, authorization_acknowledged, uploaded_by)
         values ($1::uuid,$2::uuid,$3,$4,$5,$6::bigint,$7,$8::public.textbook_source_type,$9,$10,$11::uuid)`,
        [input.id,input.textbook_id,input.storage_path,input.original_filename,input.mime_type,input.file_size,input.content_sha256,input.source_type,input.authorization_note,input.authorization_acknowledged,input.uploaded_by]));
      return "created";
    } catch (error) { return error instanceof Error && "code" in error && error.code === "23505" ? "duplicate" : "error"; }
  }
  async getDocumentForProcessing(id: string) {
    return withTrustedTransaction(async (client) => (await queryRows<ProcessingDocument>(client,
      `select id, textbook_id, storage_path, processing_status from public.textbook_documents where id = $1::uuid`, [id]))[0] ?? null);
  }
  async markProcessing(id: string, updatedAt: string) {
    await withTrustedTransaction((client) => client.query(
      `update public.textbook_documents set processing_status='processing', processing_error=null, updated_at=$2::timestamptz where id=$1::uuid`, [id, updatedAt]));
  }
  async replaceChunksAndMarkReady(id: string, rows: TextbookChunkInsert[], metadata: ReadyMetadata) {
    await withTrustedTransaction(async (client) => {
      await client.query(`delete from public.textbook_chunks where document_id=$1::uuid`, [id]);
      for (const row of rows) await client.query(
        `insert into public.textbook_chunks
          (document_id,textbook_id,chunk_index,page_start,page_end,text,character_count,metadata,embedding)
         values ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9::extensions.vector)`,
        [row.document_id,row.textbook_id,row.chunk_index,row.page_start,row.page_end,row.text,row.character_count,JSON.stringify(row.metadata),row.embedding]);
      const result = await client.query(
        `update public.textbook_documents set processing_status='ready', processing_error=null, page_count=$2,
          extracted_character_count=$3, chunk_count=$4, embedding_model=$5, embedding_dimension=$6,
          processed_at=$7::timestamptz, updated_at=$8::timestamptz where id=$1::uuid`,
        [id,metadata.page_count,metadata.extracted_character_count,metadata.chunk_count,metadata.embedding_model,metadata.embedding_dimension,metadata.processed_at,metadata.updated_at]);
      if (result.rowCount !== 1) throw new Error("Could not finalize textbook processing.");
    });
  }
  async clearChunksAndMarkFailed(id: string, errorMessage: string, updatedAt: string) {
    await withTrustedTransaction(async (client) => {
      await client.query(`delete from public.textbook_chunks where document_id=$1::uuid`, [id]);
      await client.query(`update public.textbook_documents set processing_status='failed', processing_error=$2, updated_at=$3::timestamptz where id=$1::uuid`, [id,errorMessage,updatedAt]);
    });
  }
  async getDocumentForRemoval(id: string) {
    return withTrustedTransaction(async (client) => (await queryRows<RemovalDocument>(client,
      `select id, storage_path, processing_status from public.textbook_documents where id=$1::uuid`, [id]))[0] ?? null);
  }
  async deleteDocument(id: string) {
    return withTrustedTransaction(async (client) => (await client.query(`delete from public.textbook_documents where id=$1::uuid returning id`, [id])).rowCount === 1);
  }
}
