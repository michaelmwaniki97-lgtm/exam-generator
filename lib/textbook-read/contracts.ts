export type TextbookNameRow = { id: string; name: string };

export function hasDuplicateTextbookName(candidates: TextbookNameRow[], name: string): boolean {
  const normalized = name.trim().toLocaleLowerCase("en");
  return candidates.some((candidate) => candidate.name.trim().toLocaleLowerCase("en") === normalized);
}

export type GroundingTextbook = { id: string; name: string };

export type TextbookDocumentStatus = "uploaded" | "processing" | "ready" | "failed";

export type AdminTextbookDocument = {
  id: string;
  textbook_id: string;
  original_filename: string;
  file_size: number;
  processing_status: TextbookDocumentStatus;
  processing_error: string | null;
  page_count: number | null;
  chunk_count: number | null;
  source_type: "school_supplied" | "publisher_authorized" | "oer" | "other_authorized";
  created_at: string;
};

export interface AdminTextbookReadRepository {
  listTextbooksForDuplicateCheck(subjectId: string, gradeId: string): Promise<TextbookNameRow[]>;
  textbookExists(textbookId: string): Promise<boolean>;
  listAdminTextbookDocuments(): Promise<AdminTextbookDocument[]>;
}

export interface TeacherTextbookReadRepository {
  getTextbookForGrounding(textbookId: string, subjectId: string, gradeId: string): Promise<GroundingTextbook | null>;
  getReadyDocumentId(textbookId: string, documentId?: string): Promise<string | null>;
}
