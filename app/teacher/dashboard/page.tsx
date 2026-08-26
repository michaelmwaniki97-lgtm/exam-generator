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
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Welcome back, {teacher?.name ?? user?.email}
        </h2>
        {teacher?.school && (
          <p className="mt-1 text-foreground/60">{teacher.school}</p>
        )}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">My Exams</h3>
          {exams.length > 0 && (
            <Link
              href="/teacher/exams"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-hover"
            >
              View all
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          )}
        </div>

        {exams.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
              <FileText size={26} strokeWidth={1.75} className="text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No exams yet</p>
              <p className="mt-1 text-sm font-normal text-foreground/60">
                Exams you create will show up here.
              </p>
            </div>
            <Link
              href="/teacher/exams/new"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <Plus size={16} strokeWidth={2} />
              Create your first exam
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {exams.map((exam) => (
              <Link
                key={exam.id}
                href={`/teacher/exams/${exam.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-3.5 shadow-sm transition-colors hover:border-accent/40"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {exam.subjects?.name ?? "—"} &middot; {exam.grades?.name ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs font-normal text-foreground/60">
                    {exam.exam_type} &middot; {formatDate(exam.created_at)}
                  </p>
                </div>
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                  {STATUS_LABELS[exam.status] ?? exam.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
