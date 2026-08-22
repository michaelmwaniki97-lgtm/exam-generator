import assert from "node:assert/strict";
import test from "node:test";
import { buildCurriculumRetrievalQuery, retrieveTextbookContextCore, type RetrievedTextbookChunk } from "./retrieval-core.ts";

const row = (book: string, id: string, text = "Relevant chemistry content"): RetrievedTextbookChunk => ({ chunkId: id, documentId: `doc-${book}`, textbookId: book, pageStart: 2, pageEnd: 2, text, relevanceScore: 0.9 });
test("retrieval never leaks another textbook", async () => {
  const result = await retrieveTextbookContextCore({ textbookId: "book-a", curriculumIds: ["topic-a"], query: "acids", limit: 8 }, { embedQuery: async () => [1], match: async () => [row("book-b", "wrong"), row("book-a", "right")] });
  assert.deepEqual(result.map((item) => item.chunkId), ["right"]);
});
test("retrieval respects a selected document and bounded top-k", async () => {
  let receivedLimit = 0;
  const result = await retrieveTextbookContextCore({ textbookId: "book-a", documentId: "doc-book-a", curriculumIds: ["topic-a"], query: "atoms", limit: 99 }, { embedQuery: async () => [1], match: async (_input, _embedding, limit) => { receivedLimit = limit; return Array.from({ length: 15 }, (_, index) => row("book-a", String(index))); } });
  assert.equal(receivedLimit, 12); assert.equal(result.length, 12);
});
test("empty intent returns no fake grounding", async () => {
  assert.deepEqual(await retrieveTextbookContextCore({ textbookId: "book-a", curriculumIds: [], query: "" }, { embedQuery: async () => { throw new Error("unused"); }, match: async () => [] }), []);
});
test("curriculum-aware query includes hierarchy and outcomes", () => {
  const query = buildCurriculumRetrievalQuery({ subjectName: "Chemistry", gradeName: "Form 3", topics: [{ strandName: "Mole", subStrandName: "Molar gas volume", outcomes: ["Calculate gas volumes"] }] });
  assert.match(query, /Mole > Molar gas volume/); assert.match(query, /Calculate gas volumes/);
});
