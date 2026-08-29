import Link from "next/link";
import { FileText, Plus } from "lucide-react";
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

export default async function TeacherExamsPage() {
  const rows = await (await getTeacherExamReadRepository()).listTeacherExams();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">My Exams</h2>
        <Link
          href="/teacher/exams/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} strokeWidth={2} />
          Create exam
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
            <FileText size={26} strokeWidth={1.75} className="text-accent" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No exams yet</p>
            <p className="mt-1 text-sm font-normal text-foreground/65">
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
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/40">
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Subject</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Grade</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Type</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Term</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Marks</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Status</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((exam) => (
                <tr
                  key={exam.id}
                  className="border-b border-border last:border-b-0 hover:bg-background/40"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/teacher/exams/${exam.id}`}
                      className="font-semibold text-foreground hover:text-accent"
                    >
                      {exam.subjects?.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-foreground/80">{exam.grades?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground/80">{exam.exam_type}</td>
                  <td className="px-5 py-3 text-foreground/80">
                    {exam.term ?? "—"} {exam.year ?? ""}
                  </td>
                  <td className="px-5 py-3 text-foreground/80">{exam.marks}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
                      {STATUS_LABELS[exam.status] ?? exam.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-foreground/65">
                    {formatDate(exam.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
