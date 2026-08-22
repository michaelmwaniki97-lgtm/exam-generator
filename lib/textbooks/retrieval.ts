import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts } from "./embeddings";
import { retrieveTextbookContextCore, type RetrieveTextbookContextInput, type RetrievedTextbookChunk } from "./retrieval-core";
export { buildCurriculumRetrievalQuery } from "./retrieval-core";
export type { RetrieveTextbookContextInput, RetrievedTextbookChunk } from "./retrieval-core";

async function match(input: RetrieveTextbookContextInput, embedding: number[], limit: number): Promise<RetrievedTextbookChunk[]> {
  const { data, error } = await createAdminClient().rpc("match_textbook_chunks", { p_textbook_id: input.textbookId, p_query_embedding: `[${embedding.join(",")}]`, p_limit: limit, p_document_id: input.documentId ?? null });
  if (error) throw new Error("Textbook retrieval is temporarily unavailable.");
  return (data ?? []).map((row: Record<string, unknown>) => ({ chunkId: String(row.chunk_id), documentId: String(row.document_id), textbookId: String(row.textbook_id), pageStart: Number(row.page_start), pageEnd: Number(row.page_end), text: String(row.text), relevanceScore: Number(row.relevance_score) }));
}
export async function retrieveTextbookContext(input: RetrieveTextbookContextInput): Promise<RetrievedTextbookChunk[]> {
  return retrieveTextbookContextCore(input, { embedQuery: async (query) => (await embedTexts([query], "query"))[0], match });
}
