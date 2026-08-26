import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { UUID_PATTERN } from "@/lib/admin/validation";
import { getTeacherExamReadRepository } from "@/lib/exam-read";
import { editableExamOrThrow, type StoredExamContent, type StoredMarkingContent } from "@/lib/exam-editor/core";
import { ExamEditor } from "@/components/exam-editor/exam-editor";

export default async function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const exam = await (await getTeacherExamReadRepository()).getTeacherExamForEditing(id);
  if (!exam) notFound();
  const content = exam.content as unknown as StoredExamContent;
  const schemes = exam.marking_schemes as unknown as Array<{ content: StoredMarkingContent }>;
  let unsupported: string | null = null;
  if (exam.status === "paid" || exam.status === "downloaded") unsupported = "This exam is locked because it has already been paid for or downloaded.";
  else if (schemes?.length !== 1) unsupported = "This exam does not have one compatible marking scheme.";
  else {
    try { editableExamOrThrow(content, schemes[0].content); } catch (error) { unsupported = error instanceof Error ? error.message : "This historical exam cannot be edited safely."; }
  }
  return <div className="flex flex-col gap-6">
    <div><Link href={`/teacher/exams/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"><ArrowLeft size={16} />Back to exam paper</Link><h2 className="mt-4 text-2xl font-bold text-foreground">Edit {exam.exam_type}</h2><p className="mt-1 text-sm text-foreground/60">Edit content only. Marks, order, curriculum, question type, and blueprint structure remain locked.</p></div>
    {unsupported ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">{unsupported}</div> : <ExamEditor key={exam.revision} examId={exam.id} initialRevision={exam.revision} exam={content} marking={schemes[0].content} />}
  </div>;
}
