import { CHUNK_OVERLAP_CHARACTERS, CHUNK_TARGET_CHARACTERS, MAX_DOCUMENT_CHUNKS } from "./constants.ts";

export type ExtractedPage = { page: number; text: string };
export type TextbookChunkDraft = { chunkIndex: number; pageStart: number; pageEnd: number; text: string; characterCount: number };

export function normalizeExtractedText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[\t\f\v ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitPage(text: string, target: number): string[] {
  const paragraphs = normalizeExtractedText(text).split(/\n\n+/).filter(Boolean);
  const pieces: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
    for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
      if (current && current.length + sentence.length + 1 > target) { pieces.push(current); current = ""; }
      if (sentence.length > target) {
        for (let offset = 0; offset < sentence.length; offset += target) pieces.push(sentence.slice(offset, offset + target).trim());
      } else current = current ? `${current} ${sentence}` : sentence;
    }
    if (current) current += "\n";
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces.filter((piece) => piece.length >= 40);
}

export function chunkTextbookPages(pages: readonly ExtractedPage[], target = CHUNK_TARGET_CHARACTERS, overlap = CHUNK_OVERLAP_CHARACTERS): TextbookChunkDraft[] {
  if (target < 200 || overlap < 0 || overlap >= target) throw new Error("Invalid chunking bounds.");
  const chunks: TextbookChunkDraft[] = [];
  for (const page of [...pages].sort((a, b) => a.page - b.page)) {
    const pieces = splitPage(page.text, target);
    let previousTail = "";
    for (const piece of pieces) {
      const text = normalizeExtractedText(previousTail ? `${previousTail}\n${piece}` : piece);
      if (text.length >= 40) chunks.push({ chunkIndex: chunks.length, pageStart: page.page, pageEnd: page.page, text, characterCount: text.length });
      previousTail = piece.slice(-overlap);
      if (chunks.length > MAX_DOCUMENT_CHUNKS) throw new Error(`The document exceeds the ${MAX_DOCUMENT_CHUNKS}-chunk processing limit.`);
    }
  }
  return chunks;
}
