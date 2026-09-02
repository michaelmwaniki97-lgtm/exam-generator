import { Users } from "lucide-react";
import { getIdentityReadRepository } from "@/lib/identity-read";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminTeachersPage() {
  const rows = await (await getIdentityReadRepository()).listTeachersForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Teachers</h2>
          <p className="mt-1 text-sm text-foreground/65">
            Registered teacher profiles visible to administrators.
          </p>
        </div>
        <div className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground">
          <Users size={16} className="text-accent" aria-hidden="true" />
          <span className="font-mono tabular-nums">{rows.length}</span>
          <span className="text-foreground/60">total</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-semibold text-foreground">No teachers registered yet</p>
          <p className="mt-1 text-sm text-foreground/65">
            New teacher accounts will appear here after signup.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-5 py-3 text-left font-semibold text-foreground/65">Teacher</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground/65">School</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground/65">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground/65">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((teacher) => (
                  <tr key={teacher.id} className="border-b border-border last:border-0 hover:bg-background/40">
                    <td className="px-5 py-4 font-semibold text-foreground">{teacher.name}</td>
                    <td className="px-4 py-4 text-foreground/70">{teacher.school || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-foreground/70">{teacher.phone || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-foreground/60">{formatDate(teacher.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {rows.map((teacher) => (
              <article key={teacher.id} className="rounded-lg border border-border bg-card p-4">
                <h3 className="break-words font-semibold text-foreground">{teacher.name}</h3>
                <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-foreground/55">School</dt>
                  <dd className="min-w-0 break-words text-right text-foreground/75">
                    {teacher.school || "—"}
                  </dd>
                  <dt className="text-foreground/55">Phone</dt>
                  <dd className="break-words text-right text-foreground/75">{teacher.phone || "—"}</dd>
                  <dt className="text-foreground/55">Joined</dt>
                  <dd className="text-right text-foreground/65">{formatDate(teacher.created_at)}</dd>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
