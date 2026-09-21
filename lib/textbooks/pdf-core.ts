import { MAX_EXTRACTED_CHARACTERS } from "./constants.ts";
import { normalizeExtractedText, type ExtractedPage } from "./chunking.ts";
export type ExtractedPdf = { pageCount: number; pages: ExtractedPage[]; characterCount: number };

type PdfDocumentLike = {
  numPages: number;
  getPage(pageNumber: number): Promise<{
    getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  }>;
};
type PdfLoadingTaskLike = { promise: Promise<PdfDocumentLike>; destroy(): Promise<void> };
type PdfLoader = (input: { data: Uint8Array; useWorkerFetch: false; useSystemFonts: true }) => PdfLoadingTaskLike;

export async function extractPdfTextWithLoader(bytes: Uint8Array, load: PdfLoader): Promise<ExtractedPdf> {
  const loadingTask = load({ data: bytes, useWorkerFetch: false, useSystemFonts: true });
  try {
    const document = await loadingTask.promise;
    const pages: ExtractedPage[] = []; let characterCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber); const content = await page.getTextContent();
      const text = normalizeExtractedText(content.items.map((item) => "str" in item ? item.str ?? "" : "").join(" "));
      characterCount += text.length;
      if (characterCount > MAX_EXTRACTED_CHARACTERS) throw new Error("The PDF contains more extractable text than this processing tier supports.");
      pages.push({ page: pageNumber, text });
    }
    if (characterCount < 100) throw new Error("The PDF has too little extractable text and may be scanned. OCR is not available in this phase.");
    return { pageCount: document.numPages, pages, characterCount };
  } finally {
    await loadingTask.destroy();
  }
}

export async function extractPdfTextCore(bytes: Uint8Array): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return extractPdfTextWithLoader(bytes, (input) => pdfjs.getDocument(input) as unknown as PdfLoadingTaskLike);
}
