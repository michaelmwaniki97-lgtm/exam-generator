import { MAX_RAG_CONTEXT_CHARACTERS, RETRIEVAL_TOP_K } from "./constants.ts";
export type RetrievedTextbookChunk = { chunkId: string; documentId: string; textbookId: string; pageStart: number; pageEnd: number; text: string; relevanceScore: number };
export type RetrieveTextbookContextInput = { textbookId: string; documentId?: string; curriculumIds: string[]; query: string; limit?: number };
export type RetrievalDeps = { embedQuery: (query: string) => Promise<number[]>; match: (input: RetrieveTextbookContextInput, embedding: number[], limit: number) => Promise<RetrievedTextbookChunk[]> };
export async function retrieveTextbookContextCore(input: RetrieveTextbookContextInput, deps: RetrievalDeps): Promise<RetrievedTextbookChunk[]> {
  if (!input.textbookId || input.curriculumIds.length === 0 || !input.query.trim()) return [];
  const limit = Math.min(Math.max(input.limit ?? RETRIEVAL_TOP_K, 1), 12);
  const rows = await deps.match(input, await deps.embedQuery(input.query), limit);
  let used = 0;
  return rows.filter((row) => {
    if (row.textbookId !== input.textbookId || (input.documentId && row.documentId !== input.documentId)) return false;
    if (!row.text.trim() || used + row.text.length > MAX_RAG_CONTEXT_CHARACTERS) return false;
    used += row.text.length; return true;
  }).slice(0, limit);
}
export function buildCurriculumRetrievalQuery(input: { subjectName: string; gradeName: string; topics: { strandName: string; subStrandName: string; outcomes: string[] }[] }): string {
  return [`Subject: ${input.subjectName}`, `Class: ${input.gradeName}`, ...input.topics.map((topic) => `${topic.strandName} > ${topic.subStrandName}${topic.outcomes.length ? `: ${topic.outcomes.join("; ")}` : ""}`)].join("\n");
}
