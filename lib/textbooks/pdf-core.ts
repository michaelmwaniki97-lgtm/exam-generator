import { MAX_EXTRACTED_CHARACTERS } from "./constants.ts";
import { normalizeExtractedText, type ExtractedPage } from "./chunking.ts";
export type ExtractedPdf = { pageCount: number; pages: ExtractedPage[]; characterCount: number };
export async function extractPdfTextCore(bytes: Uint8Array): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, useSystemFonts: true }).promise;
  const pages: ExtractedPage[] = []; let characterCount = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber); const content = await page.getTextContent();
    const text = normalizeExtractedText(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    characterCount += text.length;
    if (characterCount > MAX_EXTRACTED_CHARACTERS) throw new Error("The PDF contains more extractable text than this processing tier supports.");
    pages.push({ page: pageNumber, text });
  }
  if (characterCount < 100) throw new Error("The PDF has too little extractable text and may be scanned. OCR is not available in this phase.");
  return { pageCount: document.numPages, pages, characterCount };
}
