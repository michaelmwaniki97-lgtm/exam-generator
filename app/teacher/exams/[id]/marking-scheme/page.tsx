import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { UUID_PATTERN } from "@/lib/admin/validation";
import { loadCanonicalExamDocument, ExamDocumentAccessError } from "@/lib/exam-document/load";
import { MarkingDocumentView } from "@/components/exam-document/marking-document";
import { PrintButton } from "@/components/exam-document/print-button";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { getExamDownloadEntitlement } from "@/lib/payments/server";
import { paymentProviderState } from "@/lib/payments/provider-config";

export default async function MarkingSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID_PATTERN.test(id)) notFound();
  let document;
  try { document = await loadCanonicalExamDocument(id, "marking"); }
  catch (error) {
    if (error instanceof ExamDocumentAccessError) {
      if (error.status !== 422) notFound();
      return <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">This exam contains unsupported or invalid stored content and cannot be displayed safely.</div>;
    }
    console.error("Unexpected marking document display failure", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: "The marking document could not be loaded due to an unexpected server error.",
      type: error instanceof Error ? error.constructor.name : typeof error,
    });
    return <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-900">The marking scheme could not be loaded right now. Please try again.</div>;
  }
  const entitlement = await getExamDownloadEntitlement(id);
  const provider = paymentProviderState();
  return <div className={`flex flex-col gap-5 ${entitlement.allowed ? "" : "unpaid-exam-preview"}`}><div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><Link href={`/teacher/exams/${id}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-foreground/65 hover:text-foreground md:min-h-0"><ArrowLeft size={16} aria-hidden="true"/>Back to exam paper</Link>{entitlement.allowed&&<div className="flex flex-wrap gap-2"><PrintButton/><a href={`/api/exams/${id}/pdf?kind=marking`} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover md:min-h-0"><Download size={16} aria-hidden="true"/>Download marking PDF</a></div>}</div>{!entitlement.allowed&&entitlement.price!==null&&<PaymentPanel examId={id} price={entitlement.price} configured={provider.configured}/>} {!entitlement.allowed&&<p className="unpaid-print-notice hidden">Payment is required before printing or downloading this exam package.</p>}<MarkingDocumentView document={document}/></div>;
}
