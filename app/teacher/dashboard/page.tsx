import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeacherExamReadRepository } from "@/lib/exam-read";
import { getIdentityReadRepository } from "@/lib/identity-read";

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

export default async function TeacherDashboardPage() {
  const user = await getCurrentUser();
  const teacher = await (await getIdentityReadRepository()).getTeacherHeaderProfile();
  const exams = await (await getTeacherExamReadRepository()).listRecentTeacherExams(5);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground/60">Welcome back</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {teacher?.name ?? user?.email}
          </h2>
          {teacher?.school && <p className="mt-1 text-sm text-foreground/65">{teacher.school}</p>}
        </div>
        <Link
          href="/teacher/exams/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-accent-hover active:scale-[0.98] motion-reduce:transform-none sm:self-auto"
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Create exam
        </Link>
      </div>

      <section aria-labelledby="recent-exams-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h3 id="recent-exams-heading" className="text-base font-semibold text-foreground">Recent exams</h3>
            <p className="mt-1 text-sm text-foreground/60">Continue reviewing your latest assessment drafts.</p>
          </div>
          {exams.length > 0 && (
            <Link href="/teacher/exams" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-accent transition-colors hover:text-accent-hover">
              View all
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </Link>
          )}
        </div>

        {exams.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
              <FileText size={26} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No exams yet</p>
              <p className="mt-1 text-sm font-normal text-foreground/65">Create your first assessment draft to start reviewing and refining questions.</p>
            </div>
            <Link href="/teacher/exams/new" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Create your first exam
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {exams.map((exam) => (
              <Link
                key={exam.id}
                href={`/teacher/exams/${exam.id}`}
                className="group flex min-h-16 items-center justify-between gap-4 border-b border-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-background/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{exam.subjects?.name ?? "Untitled exam"}</p>
                  <p className="mt-0.5 text-xs font-normal text-foreground/65">
                    {exam.grades?.name ?? "Grade not set"} &middot; {exam.exam_type} &middot; {formatDate(exam.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs font-medium text-foreground/55 sm:inline">{STATUS_LABELS[exam.status] ?? exam.status}</span>
                  <ArrowRight size={16} className="text-foreground/35 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
