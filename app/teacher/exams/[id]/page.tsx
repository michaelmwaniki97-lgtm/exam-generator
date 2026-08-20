import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ExamSection } from "@/lib/ai/generate-exam";
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

function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} minutes`;
  if (mins === 0) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
  return `${hrs} hour${hrs === 1 ? "" : "s"} ${mins} minutes`;
}

function WriteInLine({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className="shrink-0 text-sm font-semibold text-foreground">{label}</span>
      <span className="h-0 flex-1 border-b border-dotted border-foreground/40" />
    </div>
  );
}

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, exam_type, marks, duration, difficulty, term, year, status, content, teachers(school)")
    .eq("id", id)
    .maybeSingle();

  if (!exam) notFound();

  const content = exam.content as unknown as ExamContent;
  const teacher = exam.teachers as unknown as { school: string | null } | null;
  const totalMarks = content.sections
    .flatMap((section) => section.questions)
    .reduce((sum, question) => sum + question.marks, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/teacher/exams"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Back to my exams
        </Link>
        <Link
          href={`/teacher/exams/${exam.id}/marking-scheme`}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-accent/40"
        >
          <ClipboardCheck size={16} strokeWidth={2} />
          View marking scheme
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-10">
        {/* Cover */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 print:border-foreground/60">
          {teacher?.school && (
            <p className="text-center text-base font-bold uppercase tracking-wide text-foreground">
              {teacher.school}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WriteInLine label="Name:" />
            <WriteInLine label="Admission No:" />
            <WriteInLine label="Class:" />
            <WriteInLine label="Index No:" />
          </div>

          <div className="mt-2 text-center">
            <p className="text-xl font-bold uppercase tracking-tight text-foreground">
              {content.meta.subjectName}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground/70">
              {exam.exam_type} &middot; {exam.term} {exam.year ?? ""}
            </p>
            <p className="mt-1 text-sm font-normal text-foreground/60">
              {content.meta.gradeName} ({content.meta.level}) &middot; Time: {formatDuration(exam.duration)} &middot;{" "}
              {totalMarks} marks
            </p>
          </div>

          <WriteInLine label="Candidate's Signature:" className="mt-2 sm:w-2/3" />
        </div>

        {/* Instructions */}
        <div className="mt-6 rounded-lg border border-border p-4 print:rounded-none print:border-foreground/60">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground/70">
            Instructions to candidates
          </p>
          <p className="mt-1.5 text-sm font-normal text-foreground">{content.instructions}</p>
        </div>

        {/* For examiner's use only */}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground/70">
            For examiner&apos;s use only
          </p>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border border-border px-3 py-2 text-left font-semibold text-foreground print:border-foreground/60">
                  Section
                </th>
                {content.sections.map((section) => (
                  <th
                    key={section.title}
                    className="border border-border px-3 py-2 text-center font-semibold text-foreground print:border-foreground/60"
                  >
                    {section.title.replace(/^Section\s*/i, "")}
                  </th>
                ))}
                <th className="border border-border px-3 py-2 text-center font-semibold text-foreground print:border-foreground/60">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border px-3 py-2 font-medium text-foreground/70 print:border-foreground/60">
                  Max score
                </td>
                {content.sections.map((section) => (
                  <td
                    key={section.title}
                    className="border border-border px-3 py-2 text-center tabular-nums text-foreground print:border-foreground/60"
                  >
                    {section.questions.reduce((sum, q) => sum + q.marks, 0)}
                  </td>
                ))}
                <td className="border border-border px-3 py-2 text-center font-semibold tabular-nums text-foreground print:border-foreground/60">
                  {totalMarks}
                </td>
              </tr>
              <tr>
                <td className="border border-border px-3 py-2 font-medium text-foreground/70 print:border-foreground/60">
                  Candidate&apos;s score
                </td>
                {content.sections.map((section) => (
                  <td
                    key={section.title}
                    className="border border-border px-3 py-2 print:border-foreground/60"
                  >
                    &nbsp;
                  </td>
                ))}
                <td className="border border-border px-3 py-2 print:border-foreground/60">&nbsp;</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sections & questions */}
        <div className="mt-8 flex flex-col gap-8">
          {content.sections.map((section) => {
            const sectionMarks = section.questions.reduce((sum, q) => sum + q.marks, 0);
            return (
              <div key={section.title}>
                <h3 className="mb-4 border-b border-foreground/20 pb-2 text-sm font-bold uppercase tracking-wide text-foreground">
                  {section.title} ({sectionMarks} mark{sectionMarks === 1 ? "" : "s"})
                </h3>
                <div className="flex flex-col gap-5">
                  {section.questions.map((question) => (
                    <div key={question.number} className="flex items-start justify-between gap-4">
                      <p className="text-sm font-normal leading-relaxed text-foreground">
                        <span className="font-semibold">{question.number}.</span> {question.text}
                        {question.options && question.options.length > 0 && (
                          <span className="mt-1.5 block pl-5">
                            {question.options.map((option, i) => (
                              <span key={i} className="block leading-relaxed">
                                {String.fromCharCode(65 + i)}. {option}
                              </span>
                            ))}
                          </span>
                        )}
                      </p>
                      <span className="shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-foreground/60">
                        ({question.marks} mark{question.marks === 1 ? "" : "s"})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 border-t border-foreground/20 pt-4 text-center text-xs font-normal uppercase tracking-wide text-foreground/50">
          Please check this question paper to ascertain that all questions are printed and no pages are missing.
        </p>
      </div>
    </div>
  );
}
