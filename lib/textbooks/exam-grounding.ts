import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCurriculumRetrievalQuery, retrieveTextbookContext } from "./retrieval";
import { EMBEDDING_MODEL, RETRIEVAL_TOP_K } from "./constants";

type GroundingInput = {
  textbookId: string; subjectId: string; gradeId: string; subjectName: string; gradeName: string;
  curriculumIds: string[]; topics: { strandName: string; subStrandName: string; outcomes: string[] }[];
};
export type GroundingProvenance = { textbookId: string; documentIds: string[]; chunkIds: string[]; pageReferences: { documentId: string; pageStart: number; pageEnd: number }[]; embeddingModel: string };

export async function prepareTextbookGrounding(input: GroundingInput) {
  const admin = createAdminClient();
  const { data: textbook } = await admin.from("textbooks").select("id, name").eq("id", input.textbookId).eq("subject_id", input.subjectId).eq("grade_id", input.gradeId).maybeSingle();
  if (!textbook) throw new Error("The selected textbook does not match the class and subject.");
  const { data: documents } = await admin.from("textbook_documents").select("id").eq("textbook_id", input.textbookId).eq("processing_status", "ready").order("processed_at", { ascending: false }).limit(1);
  const documentId = documents?.[0]?.id;
  if (!documentId) throw new Error("This textbook has not finished processing and cannot be used for grounded generation.");
  const query = buildCurriculumRetrievalQuery({ subjectName: input.subjectName, gradeName: input.gradeName, topics: input.topics });
  const chunks = await retrieveTextbookContext({ textbookId: input.textbookId, documentId, curriculumIds: input.curriculumIds, query, limit: RETRIEVAL_TOP_K });
  if (!chunks.length) throw new Error("No usable textbook content was found for the selected curriculum topics.");
  return {
    textbookName: textbook.name,
    context: { textbookId: input.textbookId, chunks: chunks.map(({ chunkId, documentId: id, pageStart, pageEnd, text }) => ({ chunkId, documentId: id, pageStart, pageEnd, text })) },
    provenance: { textbookId: input.textbookId, documentIds: [...new Set(chunks.map((chunk) => chunk.documentId))], chunkIds: chunks.map((chunk) => chunk.chunkId), pageReferences: chunks.map((chunk) => ({ documentId: chunk.documentId, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd })), embeddingModel: EMBEDDING_MODEL } satisfies GroundingProvenance,
  };
}
