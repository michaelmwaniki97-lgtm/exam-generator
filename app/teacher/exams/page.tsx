import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { getTeacherExamReadRepository } from "@/lib/exam-read";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  generated: "Generated",
  paid: "Paid",
  downloaded: "Downloaded",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAssessmentType(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (status === "paid" || status === "downloaded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "generated") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  return "border-border bg-background text-foreground/70";
}

export default async function TeacherExamsPage() {
  const rows = await (await getTeacherExamReadRepository()).listTeacherExams();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Exams</h2>
          <p className="mt-1 text-sm text-foreground/65">
            Open an exam to review, edit, print, or download its documents.
          </p>
        </div>
        <Link
          href="/teacher/exams/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.98] motion-reduce:transform-none"
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Create exam
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
            <FileText size={24} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No exams yet</p>
            <p className="mt-1 text-sm text-foreground/65">
              Create your first exam to start building your document library.
            </p>
          </div>
          <Link
            href="/teacher/exams/new"
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.98] motion-reduce:transform-none"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Create your first exam
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-5 py-3 text-left font-semibold text-foreground/65">Exam</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground/65">Class</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground/65">Assessment</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground/65">Marks</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground/65">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground/65">Created</th>
                  <th className="w-16 px-4 py-3"><span className="sr-only">Open exam</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((exam) => (
                  <tr
                    key={exam.id}
                    className="group border-b border-border transition-colors last:border-b-0 hover:bg-background/50"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/teacher/exams/${exam.id}`}
                        className="font-semibold text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        {exam.subjects?.name ?? "Untitled exam"}
                      </Link>
                      <p className="mt-0.5 text-xs text-foreground/55">
                        {exam.term ?? "Term not set"} {exam.year ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-foreground/75">{exam.grades?.name ?? "—"}</td>
                    <td className="px-4 py-4 text-foreground/75">{formatAssessmentType(exam.exam_type)}</td>
                    <td className="px-4 py-4 font-mono tabular-nums text-foreground/75">{exam.marks}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(exam.status)}`}>
                        {STATUS_LABELS[exam.status] ?? formatAssessmentType(exam.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-foreground/60">
                      {formatDate(exam.created_at)}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/teacher/exams/${exam.id}`}
                        aria-label={`Open ${exam.subjects?.name ?? "exam"}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/45 transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      >
                        <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {rows.map((exam) => (
              <Link
                key={exam.id}
                href={`/teacher/exams/${exam.id}`}
                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/35 active:bg-background/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {exam.subjects?.name ?? "Untitled exam"}
                    </p>
                    <p className="mt-1 text-sm text-foreground/65">
                      {exam.grades?.name ?? "Class not set"} · {formatAssessmentType(exam.exam_type)}
                    </p>
                  </div>
                  <ArrowRight size={18} className="mt-0.5 shrink-0 text-foreground/40 group-hover:text-accent" aria-hidden="true" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-xs text-foreground/60">
                  <span className={`rounded-md border px-2 py-1 font-semibold ${statusClass(exam.status)}`}>
                    {STATUS_LABELS[exam.status] ?? formatAssessmentType(exam.status)}
                  </span>
                  <span>{exam.term ?? "Term not set"} {exam.year ?? ""}</span>
                  <span>{exam.marks} marks</span>
                  <span className="ml-auto whitespace-nowrap">{formatDate(exam.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
