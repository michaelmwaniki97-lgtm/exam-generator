import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { UUID_PATTERN } from "@/lib/admin/validation";
import { loadCanonicalExamDocument, ExamDocumentAccessError } from "@/lib/exam-document/load";
import { MarkingDocumentView } from "@/components/exam-document/marking-document";
import { PrintButton } from "@/components/exam-document/print-button";

export default async function MarkingSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID_PATTERN.test(id)) notFound();
  let document;
  try { document = await loadCanonicalExamDocument(id, "marking"); }
  catch (error) { if (error instanceof ExamDocumentAccessError && error.status !== 422) notFound(); return <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">This exam contains unsupported or invalid stored content and cannot be displayed safely.</div>; }
  return <div className="flex flex-col gap-5"><div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><Link href={`/teacher/exams/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"><ArrowLeft size={16}/>Back to exam paper</Link><div className="flex gap-2"><PrintButton/><a href={`/api/exams/${id}/pdf?kind=marking`} className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"><Download size={16}/>Download marking PDF</a></div></div><MarkingDocumentView document={document}/></div>;
}
