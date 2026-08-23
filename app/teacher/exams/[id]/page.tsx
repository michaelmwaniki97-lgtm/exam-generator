import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Download } from "lucide-react";
import { UUID_PATTERN } from "@/lib/admin/validation";
import { loadCanonicalExamDocument, ExamDocumentAccessError } from "@/lib/exam-document/load";
import { ExamDocumentView } from "@/components/exam-document/exam-document";
import { PrintButton } from "@/components/exam-document/print-button";
import { PaymentPanel } from "@/components/payments/payment-panel";
import { getExamDownloadEntitlement } from "@/lib/payments/server";
import { paymentProviderState } from "@/lib/payments/provider-config";

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!UUID_PATTERN.test(id)) notFound();
  let document;
  try { document = await loadCanonicalExamDocument(id, "student"); }
  catch (error) {
    if (error instanceof ExamDocumentAccessError) {
      if (error.status !== 422) notFound();
      return <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">This exam contains unsupported or invalid stored content and cannot be displayed safely.</div>;
    }
    console.error("Unexpected exam document display failure", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: "The exam document could not be loaded due to an unexpected server error.",
      type: error instanceof Error ? error.constructor.name : typeof error,
    });
    return <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-red-900">The exam could not be loaded right now. Please try again.</div>;
  }
  const entitlement = await getExamDownloadEntitlement(id);
  const provider = paymentProviderState();
  return <div className={`flex flex-col gap-5 ${entitlement.allowed ? "" : "unpaid-exam-preview"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><Link href="/teacher/exams" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"><ArrowLeft size={16}/>Back to my exams</Link><div className="flex flex-wrap gap-2">{entitlement.allowed&&<><PrintButton/><a href={`/api/exams/${id}/pdf`} className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"><Download size={16}/>Download exam PDF</a></>}<Link href={`/teacher/exams/${id}/marking-scheme`} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold"><ClipboardCheck size={16}/>Marking scheme</Link></div></div>
    {!entitlement.allowed&&entitlement.price!==null&&<PaymentPanel examId={id} price={entitlement.price} configured={provider.configured}/>}
    {!entitlement.allowed&&<p className="unpaid-print-notice hidden">Payment is required before printing or downloading this exam package.</p>}
    <ExamDocumentView document={document}/>
  </div>;
}
