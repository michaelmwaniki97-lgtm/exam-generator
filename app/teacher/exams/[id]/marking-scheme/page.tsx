import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ExamSection, MarkingSchemeEntry } from "@/lib/ai/generate-exam";
import { UUID_PATTERN } from "@/lib/admin/validation";

type ExamContent = {
  instructions: string;
  sections: ExamSection[];
  meta: {
    level: string;
    subjectName: string;
    gradeName: string;
    textbookName: string | null;
    topicIds: string[];
  };
};

export default async function MarkingSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, exam_type, marks, term, year, content, marking_schemes(content)")
    .eq("id", id)
    .maybeSingle();

  if (!exam) notFound();

  const content = exam.content as unknown as ExamContent;
  const markingSchemeRows = exam.marking_schemes as unknown as { content: { entries: MarkingSchemeEntry[] } }[];
  const entries = markingSchemeRows?.[0]?.content?.entries ?? [];
  const entryByNumber = new Map(entries.map((entry) => [entry.number, entry]));
  const totalMarks = content.sections
    .flatMap((section) => section.questions)
    .reduce((sum, question) => sum + question.marks, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="print:hidden">
        <Link
          href={`/teacher/exams/${exam.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back to exam paper
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-10">
        <div className="flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-white print:rounded-none">
          <Lock size={14} strokeWidth={2.5} />
          <p className="text-xs font-bold uppercase tracking-wide">Confidential &middot; Examiner use only</p>
        </div>

        <div className="mt-6 border-b border-border pb-6 text-center print:border-foreground/60">
          <p className="text-xl font-bold uppercase tracking-tight text-foreground">
            {content.meta.subjectName} Marking Scheme
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground/70">
            {exam.exam_type} &middot; {exam.term} {exam.year ?? ""}
          </p>
          <p className="mt-1 text-sm font-normal text-foreground/60">
            {content.meta.gradeName} ({content.meta.level}) &middot; {totalMarks} marks
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-8">
          {content.sections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 border-b border-foreground/20 pb-2 text-sm font-bold uppercase tracking-wide text-foreground">
                {section.title}
              </h3>
              <div className="flex flex-col gap-4">
                {section.questions.map((question) => {
                  const entry = entryByNumber.get(question.number);
                  return (
                    <div key={question.number} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {question.number}. {entry?.answer ?? "Not provided"}
                        </p>
                        {entry?.marking_notes && (
                          <p className="mt-1 text-sm font-normal text-foreground/60">
                            {entry.marking_notes}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-foreground/60">
                        ({question.marks} mark{question.marks === 1 ? "" : "s"})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
