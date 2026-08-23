import { UUID_PATTERN } from "@/lib/admin/validation";
import { loadCanonicalExamDocument, ExamDocumentAccessError } from "@/lib/exam-document/load";
import { renderExamPdf } from "@/lib/exam-document/pdf";
import { parseExamDocumentKind, safePdfFilename } from "@/lib/exam-document/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return new Response("Not found.", { status: 404 });
  let kind;
  try { kind = parseExamDocumentKind(new URL(request.url).searchParams); }
  catch { return new Response("Invalid document kind.", { status: 400, headers: { "Cache-Control": "no-store" } }); }
  try {
    const document = await loadCanonicalExamDocument(id, kind, { requirePaid: true });
    const pdf = await renderExamPdf(document);
    if (!pdf.length || pdf.length > 25_000_000) return new Response("The PDF could not be generated safely.", { status: 422 });
    const filename = safePdfFilename([document.school, document.subject, document.grade, document.term, document.year, document.paperCode], kind === "marking");
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof ExamDocumentAccessError) return new Response(error.message, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return new Response("The PDF could not be generated safely.", { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
