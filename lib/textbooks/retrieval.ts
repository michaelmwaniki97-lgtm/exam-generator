import "server-only";
import { getTrustedRpcDatabase } from "@/lib/db";
import { embedTexts } from "./embeddings";
import { retrieveTextbookContextCore, type RetrieveTextbookContextInput, type RetrievedTextbookChunk } from "./retrieval-core";
export { buildCurriculumRetrievalQuery } from "./retrieval-core";
export type { RetrieveTextbookContextInput, RetrievedTextbookChunk } from "./retrieval-core";

async function match(input: RetrieveTextbookContextInput, embedding: number[], limit: number): Promise<RetrievedTextbookChunk[]> {
  try {
    const data = await getTrustedRpcDatabase().matchTextbookChunks({ textbookId: input.textbookId, queryEmbedding: embedding, limit, documentId: input.documentId });
    return data.map((row) => ({ chunkId: String(row.chunk_id), documentId: String(row.document_id), textbookId: String(row.textbook_id), pageStart: Number(row.page_start), pageEnd: Number(row.page_end), text: String(row.text), relevanceScore: Number(row.relevance_score) }));
  } catch {
    throw new Error("Textbook retrieval is temporarily unavailable.");
  }
}
export async function retrieveTextbookContext(input: RetrieveTextbookContextInput): Promise<RetrievedTextbookChunk[]> {
  return retrieveTextbookContextCore(input, { embedQuery: async (query) => (await embedTexts([query], "query"))[0], match });
}
