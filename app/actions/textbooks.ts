"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/auth/access";
import { getCurrentUser, getUserRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkTextbookPages } from "@/lib/textbooks/chunking";
import { embedTexts } from "@/lib/textbooks/embeddings";
import { extractPdfText } from "@/lib/textbooks/pdf";
import { EMBEDDING_BATCH_SIZE, EMBEDDING_DIMENSION, EMBEDDING_MODEL, TEXTBOOK_BUCKET } from "@/lib/textbooks/constants";
import { hasPdfSignature, isSourceType, safePdfFilename, validateUploadMetadata, type UploadFileLike } from "@/lib/textbooks/validation";
import { UUID_PATTERN } from "@/lib/admin/validation";

export type TextbookActionState = { status: "success" | "error"; message: string } | undefined;
const result = (status: "success" | "error", message: string): TextbookActionState => ({ status, message });

async function adminContext() {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || !isAdminRole(role)) return null;
  return { user, supabase: createAdminClient() };
}

function safeNote(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const note = value.trim().replace(/\s+/g, " ");
  return note ? note.slice(0, 500) : null;
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
  const { data: textbook } = await context.supabase.from("textbooks").select("id").eq("id", textbookId).maybeSingle();
  if (!textbook) return result("error", "The selected textbook record does not exist.");
  const documentId = randomUUID();
  const storagePath = `textbooks/${textbookId}/${documentId}/${safePdfFilename(file!.name)}`;
  const hash = createHash("sha256").update(bytes).digest("hex");
  const { error: storageError } = await context.supabase.storage.from(TEXTBOOK_BUCKET).upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (storageError) return result("error", "The private PDF upload failed.");
  const { error: insertError } = await context.supabase.from("textbook_documents").insert({
    id: documentId, textbook_id: textbookId, storage_path: storagePath, original_filename: safePdfFilename(file!.name), mime_type: "application/pdf",
    file_size: file!.size, content_sha256: hash, source_type: sourceType, authorization_note: safeNote(formData.get("authorizationNote")),
    authorization_acknowledged: true, uploaded_by: context.user.id,
  });
  if (insertError) { await context.supabase.storage.from(TEXTBOOK_BUCKET).remove([storagePath]); return result("error", insertError.code === "23505" ? "This exact PDF is already uploaded for the textbook." : "Could not create the textbook document record."); }
  revalidatePath("/admin/textbooks");
  return result("success", "PDF uploaded privately. Start processing when ready.");
}

export async function processTextbookDocument(_state: TextbookActionState, formData: FormData): Promise<TextbookActionState> {
  const context = await adminContext();
  if (!context) return result("error", "Administrator access is required.");
  const documentId = String(formData.get("documentId") ?? "");
  if (!UUID_PATTERN.test(documentId)) return result("error", "Invalid textbook document.");
  const { data: document } = await context.supabase.from("textbook_documents").select("id, textbook_id, storage_path, processing_status").eq("id", documentId).maybeSingle();
  if (!document) return result("error", "Textbook document not found.");
  if (document.processing_status === "processing") return result("error", "This document is already processing.");
  await context.supabase.from("textbook_documents").update({ processing_status: "processing", processing_error: null, updated_at: new Date().toISOString() }).eq("id", documentId);
  try {
    const { data: blob, error: downloadError } = await context.supabase.storage.from(TEXTBOOK_BUCKET).download(document.storage_path);
    if (downloadError || !blob) throw new Error("The private PDF could not be read.");
    const extracted = await extractPdfText(new Uint8Array(await blob.arrayBuffer()));
    const chunks = chunkTextbookPages(extracted.pages);
    if (!chunks.length) throw new Error("No usable textbook chunks could be extracted.");
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const embeddings = await embedTexts(batch.map((chunk) => chunk.text), "passage");
      batch.forEach((chunk, index) => rows.push({ document_id: document.id, textbook_id: document.textbook_id, chunk_index: chunk.chunkIndex, page_start: chunk.pageStart, page_end: chunk.pageEnd, text: chunk.text, character_count: chunk.characterCount, metadata: { pageStart: chunk.pageStart, pageEnd: chunk.pageEnd }, embedding: `[${embeddings[index].join(",")}]` }));
    }
    await context.supabase.from("textbook_chunks").delete().eq("document_id", document.id);
    for (let offset = 0; offset < rows.length; offset += 100) {
      const { error } = await context.supabase.from("textbook_chunks").insert(rows.slice(offset, offset + 100));
      if (error) throw new Error("The extracted textbook chunks could not be indexed.");
    }
    await context.supabase.from("textbook_documents").update({ processing_status: "ready", processing_error: null, page_count: extracted.pageCount, extracted_character_count: extracted.characterCount, chunk_count: chunks.length, embedding_model: EMBEDDING_MODEL, embedding_dimension: EMBEDDING_DIMENSION, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", document.id);
    revalidatePath("/admin/textbooks");
    return result("success", `Textbook ready: ${extracted.pageCount} pages and ${chunks.length} chunks indexed.`);
  } catch (error) {
    const safeError = error instanceof Error && /^(The PDF|No usable|The private PDF|The extracted)/.test(error.message) ? error.message : "Text extraction or indexing failed. The document was not made available to teachers.";
    await context.supabase.from("textbook_chunks").delete().eq("document_id", document.id);
    await context.supabase.from("textbook_documents").update({ processing_status: "failed", processing_error: safeError.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", document.id);
    revalidatePath("/admin/textbooks");
    return result("error", safeError);
  }
}

export async function removeTextbookDocument(_state: TextbookActionState, formData: FormData): Promise<TextbookActionState> {
  const context = await adminContext();
  if (!context) return result("error", "Administrator access is required.");
  const documentId = String(formData.get("documentId") ?? "");
  if (!UUID_PATTERN.test(documentId)) return result("error", "Invalid textbook document.");
  const { data: document } = await context.supabase.from("textbook_documents").select("id, storage_path, processing_status").eq("id", documentId).maybeSingle();
  if (!document) return result("error", "Textbook document not found.");
  if (document.processing_status === "ready" || document.processing_status === "processing") return result("error", "Ready or processing documents cannot be removed because generation provenance may depend on them.");
  await context.supabase.storage.from(TEXTBOOK_BUCKET).remove([document.storage_path]);
  const { error } = await context.supabase.from("textbook_documents").delete().eq("id", document.id);
  if (error) return result("error", "Could not remove the textbook document.");
  revalidatePath("/admin/textbooks");
  return result("success", "Textbook document removed.");
}
