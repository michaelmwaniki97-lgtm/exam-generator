import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminTextbookDocument, AdminTextbookReadRepository, GroundingTextbook, TeacherTextbookReadRepository, TextbookNameRow } from "./contracts.ts";

function fail(): never { throw new Error("Could not load textbook metadata."); }

export class SupabaseTextbookReadRepository implements AdminTextbookReadRepository, TeacherTextbookReadRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async listTextbooksForDuplicateCheck(subjectId: string, gradeId: string): Promise<TextbookNameRow[]> {
    const { data, error } = await this.client.from("textbooks").select("id, name").eq("subject_id", subjectId).eq("grade_id", gradeId);
    if (error) fail();
    return data ?? [];
  }

  async textbookExists(textbookId: string): Promise<boolean> {
    const { data, error } = await this.client.from("textbooks").select("id").eq("id", textbookId).maybeSingle();
    if (error) fail();
    return Boolean(data);
  }

  async listAdminTextbookDocuments(): Promise<AdminTextbookDocument[]> {
    const { data, error } = await this.client.from("textbook_documents")
      .select("id, textbook_id, original_filename, file_size, processing_status, processing_error, page_count, chunk_count, source_type, created_at")
      .order("created_at", { ascending: false });
    if (error) fail();
    return (data ?? []) as AdminTextbookDocument[];
  }

  async getTextbookForGrounding(textbookId: string, subjectId: string, gradeId: string): Promise<GroundingTextbook | null> {
    const { data: textbook, error: textbookError } = await this.client.from("textbooks").select("id, name")
      .eq("id", textbookId).eq("subject_id", subjectId).eq("grade_id", gradeId).maybeSingle();
    if (textbookError) fail();
    return textbook;
  }

  async getReadyDocumentId(textbookId: string, documentId?: string): Promise<string | null> {
    let query = this.client.from("textbook_documents").select("id").eq("textbook_id", textbookId).eq("processing_status", "ready");
    if (documentId) query = query.eq("id", documentId);
    const { data: documents, error: documentError } = await query.order("processed_at", { ascending: false }).limit(1);
    if (documentError) fail();
    return documents?.[0]?.id ?? null;
  }
}
