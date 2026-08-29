import Link from "next/link";
import { ClipboardCheck, FileText, Pencil } from "lucide-react";
import { UUID_PATTERN } from "@/lib/admin/validation";
import { notFound } from "next/navigation";

export default async function ExamWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  return <div className="flex flex-col gap-4">
    <nav aria-label="Exam workspace" className="flex flex-wrap gap-2 print:hidden">
      <Link href={`/teacher/exams/${id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold md:min-h-0"><FileText size={15} aria-hidden="true" />Exam paper</Link>
      <Link href={`/teacher/exams/${id}/edit`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold md:min-h-0"><Pencil size={15} aria-hidden="true" />Edit exam</Link>
      <Link href={`/teacher/exams/${id}/marking-scheme`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold md:min-h-0"><ClipboardCheck size={15} aria-hidden="true" />Marking scheme</Link>
    </nav>
    {children}
  </div>;
}
