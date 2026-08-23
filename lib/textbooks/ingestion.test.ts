import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../next.config.ts";
import { chunkTextbookPages } from "./chunking.ts";
import { extractPdfTextCore } from "./pdf-core.ts";
import { hasPdfSignature, safePdfFilename, validateUploadMetadata } from "./validation.ts";
import { MAX_PDF_BYTES } from "./constants.ts";

const file = (overrides: Partial<{ name: string; type: string; size: number }> = {}) => ({ name: "book.pdf", type: "application/pdf", size: 100, arrayBuffer: async () => new ArrayBuffer(0), ...overrides });
function textPdf(text: string): Uint8Array {
  const escaped = text.replace(/([()\\])/g, "\\$1");
  const stream = `BT /F1 10 Tf 40 740 Td (${escaped}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n"; const offsets = [0]; objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
test("upload validation rejects MIME, extension, empty and oversized files", () => {
  assert.match(validateUploadMetadata(file({ type: "text/plain" })) ?? "", /Only PDF/); assert.match(validateUploadMetadata(file({ name: "book.exe" })) ?? "", /\.pdf/);
  assert.match(validateUploadMetadata(file({ size: 0 })) ?? "", /empty/); assert.match(validateUploadMetadata(file({ size: MAX_PDF_BYTES + 1 })) ?? "", /12 MiB/);
});
test("PDF signature and malicious filename handling are safe", () => {
  assert.equal(hasPdfSignature(new TextEncoder().encode("%PDF-1.4")), true); assert.equal(hasPdfSignature(new TextEncoder().encode("MZ...")), false);
  assert.equal(safePdfFilename("../../evil<script>.pdf"), "evil-script.pdf");
});
test("chunking is deterministic, ordered, overlapped, page-bound and empty-safe", () => {
  const pages = [{ page: 2, text: "Second page content. ".repeat(80) }, { page: 1, text: "First page content. ".repeat(80) }, { page: 3, text: "   " }];
  const first = chunkTextbookPages(pages, 500, 80); const second = chunkTextbookPages(pages, 500, 80);
  assert.deepEqual(first, second); assert.equal(first[0].pageStart, 1); assert.ok(first.every((chunk) => chunk.pageStart === chunk.pageEnd && chunk.text.length <= 580)); assert.ok(first.length > 2);
});
test("Next server extraction keeps PDF.js external and off browser workers", async () => {
  assert.ok(nextConfig.serverExternalPackages?.includes("pdfjs-dist"));
  const extracted = await extractPdfTextCore(textPdf("Server-side chemistry textbook content. ".repeat(6)));
  assert.match(extracted.pages[0].text, /Server-side chemistry textbook content/);
});
test("text PDF extraction preserves page order and content", async () => {
  const phrase = "Chemistry explains matter and its transformations. ".repeat(6); const extracted = await extractPdfTextCore(textPdf(phrase));
  assert.equal(extracted.pageCount, 1); assert.equal(extracted.pages[0].page, 1); assert.match(extracted.pages[0].text, /Chemistry explains matter/);
});
test("empty or scanned-like PDF fails instead of becoming ready", async () => {
  await assert.rejects(() => extractPdfTextCore(textPdf("image only")), /too little extractable text/);
});
