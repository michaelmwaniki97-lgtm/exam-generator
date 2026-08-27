"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/auth/access";
import { getCurrentUser, getUserRole } from "@/lib/auth/session";
import { chunkTextbookPages } from "@/lib/textbooks/chunking";
import { embedTexts } from "@/lib/textbooks/embeddings";
import { extractPdfText } from "@/lib/textbooks/pdf";
import { EMBEDDING_BATCH_SIZE, EMBEDDING_DIMENSION, EMBEDDING_MODEL } from "@/lib/textbooks/constants";
import { hasPdfSignature, isSourceType, safePdfFilename, validateUploadMetadata, type UploadFileLike } from "@/lib/textbooks/validation";
import { UUID_PATTERN } from "@/lib/admin/validation";
import { getCatalogRepository } from "@/lib/catalog";
import { getAdminTextbookReadRepository, hasDuplicateTextbookName } from "@/lib/textbook-read";
import { getTextbookStorageProvider } from "@/lib/textbook-storage";
import { getTextbookWorkflowRepository, type TextbookChunkInsert } from "@/lib/textbook-workflow";

export type TextbookActionState = { status: "success" | "error"; message: string } | undefined;
const result = (status: "success" | "error", message: string): TextbookActionState => ({ status, message });

async function adminContext() {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || !isAdminRole(role)) return null;
  return { user };
}

function safeNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const note = value.trim().replace(/\s+/g, " ");
  return note ? note.slice(0, 500) : null;
}

type ProcessingStage = "storage_download" | "pdf_extraction" | "chunking" | "embedding" | "chunk_insert" | "finalize";
function diagnosticError(error: unknown): string { const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown non-Error failure"; return message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").replace(/https?:\/\/\S+/gi, "[url redacted]").replace(/\s+/g, " ").slice(0, 500); }
function processingFailureMessage(stage: ProcessingStage, error: unknown): string { if (stage === "storage_download") return "The private PDF could not be read."; if (stage === "pdf_extraction") return error instanceof Error && error.message.startsWith("The PDF") ? error.message : "PDF text extraction failed."; if (stage === "chunking") return error instanceof Error && error.message.startsWith("No usable") ? error.message : "Textbook chunking failed."; if (stage === "embedding") return "Embedding generation failed."; if (stage === "chunk_insert") return "Textbook indexing failed."; return "Could not finalize textbook processing."; }
export async function createTextbookRecord(_state: TextbookActionState, formData: FormData): Promise<TextbookActionState> {
  const context = await adminContext();
  if (!context) return result("error", "Administrator access is required.");
  const name = String(formData.get("name") ?? "").trim();
  const publisherValue = String(formData.get("publisher") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "");
  const gradeId = String(formData.get("gradeId") ?? "");
  if (!name) return result("error", "Textbook name is required.");
  if (name.length > 180) return result("error", "Textbook name must be 180 characters or fewer.");
  if (publisherValue.length > 180) return result("error", "Publisher must be 180 characters or fewer.");
  if (!UUID_PATTERN.test(subjectId)) return result("error", "Select a valid subject.");
  if (!UUID_PATTERN.test(gradeId)) return result("error", "Select a valid grade or form.");
  const catalog = await getCatalogRepository();
  const textbookReads = await getAdminTextbookReadRepository();
  const [subject, grade, existing] = await Promise.all([
    catalog.subjectExists(subjectId).catch(() => false),
    catalog.gradeExists(gradeId).catch(() => false),
    textbookReads.listTextbooksForDuplicateCheck(subjectId, gradeId).catch(() => []),
  ]);
  if (!subject || !grade) return result("error", "The selected subject or grade does not exist.");
  if (hasDuplicateTextbookName(existing, name)) {
    return result("error", "A textbook with this name already exists for the selected subject and grade.");
  }
  const created = await (await getTextbookWorkflowRepository()).createTextbook({
    name,
    publisher: publisherValue || null,
    subject_id: subjectId,
    grade_id: gradeId,
  });
  if (!created) return result("error", "Could not create the textbook record.");
  revalidatePath("/admin/textbooks");
  return result("success", "Textbook record created. It is now available for PDF upload.");
}
export async function uploadTextbookDocument(_state: TextbookActionState, formData: FormData): Promise<TextbookActionState> {
  const context = await adminContext();
  if (!context) return result("error", "Administrator access is required.");
  const textbookId = String(formData.get("textbookId") ?? "");
  const sourceType = String(formData.get("sourceType") ?? "");
  const file = formData.get("pdf") as unknown as UploadFileLike | null;
  if (!UUID_PATTERN.test(textbookId)) return result("error", "Select a valid textbook record.");
  if (!isSourceType(sourceType)) return result("error", "Select a valid authorized source type.");
  if (formData.get("authorizationAcknowledged") !== "on") return result("error", "Confirm that this private upload is authorized.");
  const metadataError = validateUploadMetadata(file);
  if (metadataError) return result("error", metadataError);
  const bytes = new Uint8Array(await file!.arrayBuffer());
  if (!hasPdfSignature(bytes)) return result("error", "The uploaded file does not have a valid PDF signature.");
  if (!await (await getAdminTextbookReadRepository()).textbookExists(textbookId).catch(() => false)) return result("error", "The selected textbook record does not exist.");
  const documentId = randomUUID();
  const storagePath = `textbooks/${textbookId}/${documentId}/${safePdfFilename(file!.name)}`;
  const hash = createHash("sha256").update(bytes).digest("hex");
  const storage = getTextbookStorageProvider();
  try { await storage.put(storagePath, bytes, "application/pdf"); }
  catch { return result("error", "The private PDF upload failed."); }
  const insertResult = await (await getTextbookWorkflowRepository()).createDocument({
    id: documentId, textbook_id: textbookId, storage_path: storagePath, original_filename: safePdfFilename(file!.name), mime_type: "application/pdf",
    file_size: file!.size, content_sha256: hash, source_type: sourceType, authorization_note: safeNote(formData.get("authorizationNote")),
    authorization_acknowledged: true, uploaded_by: context.user.id,
  });
  if (insertResult !== "created") {
    await storage.delete(storagePath).catch(() => undefined);
    return result("error", insertResult === "duplicate" ? "This exact PDF is already uploaded for the textbook." : "Could not create the textbook document record.");
  }
  revalidatePath("/admin/textbooks");
  return result("success", "PDF uploaded privately. Start processing when ready.");
}

export async function processTextbookDocument(_state: TextbookActionState, formData: FormData): Promise<TextbookActionState> {
  const context = await adminContext();
  if (!context) return result("error", "Administrator access is required.");
  const documentId = String(formData.get("documentId") ?? "");
  if (!UUID_PATTERN.test(documentId)) return result("error", "Invalid textbook document.");
  const repository = await getTextbookWorkflowRepository();
  const document = await repository.getDocumentForProcessing(documentId).catch(() => null);
  if (!document) return result("error", "Textbook document not found.");
  if (document.processing_status === "processing") return result("error", "This document is already processing.");
  await repository.markProcessing(documentId, new Date().toISOString()).catch(() => undefined);
  let stage: ProcessingStage = "storage_download";
  try {
    const bytes = await getTextbookStorageProvider().get(document.storage_path);
    stage = "pdf_extraction";
    const extracted = await extractPdfText(bytes);
    stage = "chunking";
    const chunks = chunkTextbookPages(extracted.pages);
    if (!chunks.length) throw new Error("No usable textbook chunks could be extracted.");
    const rows: TextbookChunkInsert[] = [];
    stage = "embedding";
    for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const embeddings = await embedTexts(batch.map((chunk) => chunk.text), "passage");
      batch.forEach((chunk, index) => rows.push({ document_id: document.id, textbook_id: document.textbook_id, chunk_index: chunk.chunkIndex, page_start: chunk.pageStart, page_end: chunk.pageEnd, text: chunk.text, character_count: chunk.characterCount, metadata: { pageStart: chunk.pageStart, pageEnd: chunk.pageEnd }, embedding: `[${embeddings[index].join(",")}]` }));
    }
    stage = "chunk_insert";
    const processedAt = new Date().toISOString();
    await repository.replaceChunksAndMarkReady(document.id, rows, { page_count: extracted.pageCount, extracted_character_count: extracted.characterCount, chunk_count: chunks.length, embedding_model: EMBEDDING_MODEL, embedding_dimension: EMBEDDING_DIMENSION, processed_at: processedAt, updated_at: processedAt });
    revalidatePath("/admin/textbooks");
    return result("success", `Textbook ready: ${extracted.pageCount} pages and ${chunks.length} chunks indexed.`);
  } catch (error) {
    if (error instanceof Error && error.message === "Could not finalize textbook processing.") stage = "finalize";
    const safeError = processingFailureMessage(stage, error);
    if (process.env.NODE_ENV === "development") {
      console.error(`[Textbook Processing] stage=${stage} document=${document.id} error=${diagnosticError(error)}`);
    }
    await repository.clearChunksAndMarkFailed(document.id, safeError.slice(0, 300), new Date().toISOString()).catch(() => undefined);
    revalidatePath("/admin/textbooks");
    return result("error", safeError);
  }
}

export async function removeTextbookDocument(_state: TextbookActionState, formData: FormData): Promise<TextbookActionState> {
  const context = await adminContext();
  if (!context) return result("error", "Administrator access is required.");
  const documentId = String(formData.get("documentId") ?? "");
  if (!UUID_PATTERN.test(documentId)) return result("error", "Invalid textbook document.");
  const repository = await getTextbookWorkflowRepository();
  const document = await repository.getDocumentForRemoval(documentId).catch(() => null);
  if (!document) return result("error", "Textbook document not found.");
  if (document.processing_status === "ready" || document.processing_status === "processing") return result("error", "Ready or processing documents cannot be removed because generation provenance may depend on them.");
  try { await getTextbookStorageProvider().delete(document.storage_path); }
  catch { return result("error", "Could not remove the textbook document."); }
  if (!await repository.deleteDocument(document.id).catch(() => false)) return result("error", "Could not remove the textbook document.");
  revalidatePath("/admin/textbooks");
  return result("success", "Textbook document removed.");
}
