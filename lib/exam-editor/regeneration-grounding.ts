import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCurriculumRetrievalQuery, retrieveTextbookContext } from "@/lib/textbooks/retrieval";
import { EMBEDDING_MODEL, RETRIEVAL_TOP_K } from "@/lib/textbooks/constants";
import type { GroundingProvenance } from "@/lib/textbooks/exam-grounding";

export async function prepareRegenerationGrounding(input: {
  provenance: GroundingProvenance; subjectId: string; gradeId: string; subjectName: string; gradeName: string;
  curriculumIds: string[]; topics: { strandName: string; subStrandName: string; outcomes: string[] }[];
}) {
  const admin = createAdminClient();
  const { data: textbook } = await admin.from("textbooks").select("id, name").eq("id", input.provenance.textbookId).eq("subject_id", input.subjectId).eq("grade_id", input.gradeId).maybeSingle();
  if (!textbook) throw new Error("The exam's textbook no longer matches its class and subject.");
  const documentId = input.provenance.documentIds[0];
  if (!documentId) throw new Error("The exam does not contain a usable textbook document reference.");
  const { data: document } = await admin.from("textbook_documents").select("id").eq("id", documentId).eq("textbook_id", textbook.id).eq("processing_status", "ready").maybeSingle();
  if (!document) throw new Error("The textbook document used by this exam is no longer ready.");
  const query = buildCurriculumRetrievalQuery({ subjectName: input.subjectName, gradeName: input.gradeName, topics: input.topics });
  const chunks = await retrieveTextbookContext({ textbookId: textbook.id, documentId: document.id, curriculumIds: input.curriculumIds, query, limit: RETRIEVAL_TOP_K });
  if (!chunks.length) throw new Error("No usable textbook content was found for this question's curriculum topic.");
  return {
    textbookName: textbook.name,
    context: { textbookId: textbook.id, chunks: chunks.map(({ chunkId, documentId: id, pageStart, pageEnd, text }) => ({ chunkId, documentId: id, pageStart, pageEnd, text })) },
    provenance: { textbookId: textbook.id, documentIds: [...new Set(chunks.map((chunk) => chunk.documentId))], chunkIds: chunks.map((chunk) => chunk.chunkId), pageReferences: chunks.map((chunk) => ({ documentId: chunk.documentId, pageStart: chunk.pageStart, pageEnd: chunk.pageEnd })), embeddingModel: EMBEDDING_MODEL } satisfies GroundingProvenance,
  };
}
