import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadyMetadata, RemovalDocument, ProcessingDocument, TextbookDocumentInsert, TextbookChunkInsert, TextbookWorkflowRepository } from "./contracts.ts";

export class SupabaseTextbookWorkflowRepository implements TextbookWorkflowRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }
  async createTextbook(input: { name: string; publisher: string | null; subject_id: string; grade_id: string }) {
    const { error } = await this.client.from("textbooks").insert(input); return !error;
  }
  async createDocument(input: TextbookDocumentInsert) {
    const { error } = await this.client.from("textbook_documents").insert(input);
    return !error ? "created" as const : error.code === "23505" ? "duplicate" as const : "error" as const;
  }
  async getDocumentForProcessing(id: string) {
    const { data } = await this.client.from("textbook_documents").select("id, textbook_id, storage_path, processing_status").eq("id", id).maybeSingle();
    return data as ProcessingDocument | null;
  }
  async markProcessing(id: string, updatedAt: string) {
    await this.client.from("textbook_documents").update({ processing_status: "processing", processing_error: null, updated_at: updatedAt }).eq("id", id);
  }
  async replaceChunksAndMarkReady(id: string, rows: TextbookChunkInsert[], metadata: ReadyMetadata) {
    const deletion = await this.client.from("textbook_chunks").delete().eq("document_id", id);
    if (deletion.error) throw new Error("Could not replace textbook chunks.");
    for (let offset = 0; offset < rows.length; offset += 100) {
      const { error } = await this.client.from("textbook_chunks").insert(rows.slice(offset, offset + 100));
      if (error) throw new Error("Could not insert textbook chunks.");
    }
    const { error } = await this.client.from("textbook_documents").update({ processing_status: "ready", processing_error: null, ...metadata }).eq("id", id);
    if (error) throw new Error("Could not finalize textbook processing.");
  }
  async clearChunksAndMarkFailed(id: string, errorMessage: string, updatedAt: string) {
    await this.client.from("textbook_chunks").delete().eq("document_id", id);
    await this.client.from("textbook_documents").update({ processing_status: "failed", processing_error: errorMessage, updated_at: updatedAt }).eq("id", id);
  }
  async getDocumentForRemoval(id: string) {
    const { data } = await this.client.from("textbook_documents").select("id, storage_path, processing_status").eq("id", id).maybeSingle();
    return data as RemovalDocument | null;
  }
  async deleteDocument(id: string) {
    const { data, error } = await this.client.from("textbook_documents").delete().eq("id", id).select("id");
    return !error && Array.isArray(data) && data.length > 0;
  }
}
