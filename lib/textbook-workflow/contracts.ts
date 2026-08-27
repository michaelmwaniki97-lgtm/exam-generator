export type ProcessingDocument = { id: string; textbook_id: string; storage_path: string; processing_status: "uploaded" | "processing" | "ready" | "failed" };
export type RemovalDocument = Pick<ProcessingDocument, "id" | "storage_path" | "processing_status">;
export type TextbookChunkInsert = { document_id: string; textbook_id: string; chunk_index: number; page_start: number; page_end: number; text: string; character_count: number; metadata: { pageStart: number; pageEnd: number }; embedding: string };
export type TextbookDocumentInsert = { id: string; textbook_id: string; storage_path: string; original_filename: string; mime_type: "application/pdf"; file_size: number; content_sha256: string; source_type: "school_supplied" | "publisher_authorized" | "oer" | "other_authorized"; authorization_note: string | null; authorization_acknowledged: true; uploaded_by: string };
export type ReadyMetadata = { page_count: number; extracted_character_count: number; chunk_count: number; embedding_model: string; embedding_dimension: number; processed_at: string; updated_at: string };

export interface TextbookWorkflowRepository {
  createTextbook(input: { name: string; publisher: string | null; subject_id: string; grade_id: string }): Promise<boolean>;
  createDocument(input: TextbookDocumentInsert): Promise<"created" | "duplicate" | "error">;
  getDocumentForProcessing(id: string): Promise<ProcessingDocument | null>;
  markProcessing(id: string, updatedAt: string): Promise<void>;
  replaceChunksAndMarkReady(id: string, rows: TextbookChunkInsert[], metadata: ReadyMetadata): Promise<void>;
  clearChunksAndMarkFailed(id: string, error: string, updatedAt: string): Promise<void>;
  getDocumentForRemoval(id: string): Promise<RemovalDocument | null>;
  deleteDocument(id: string): Promise<boolean>;
}
