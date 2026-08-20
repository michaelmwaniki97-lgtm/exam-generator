import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminTeachersPage() {
  const supabase = await createClient();
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, name, school, phone, created_at")
    .order("created_at", { ascending: false });
  const rows = teachers ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Teachers</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Registered teacher profiles visible to administrators.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent">
          <Users size={16} aria-hidden="true" />
          {rows.length}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-14 text-center shadow-sm">
          <p className="font-semibold text-foreground">No teachers registered yet</p>
          <p className="mt-1 text-sm text-foreground/60">
            New teacher accounts will appear here after signup.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border bg-background/40">
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Teacher</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">School</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Phone</th>
                <th className="px-5 py-3 text-left font-semibold text-foreground/70">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((teacher) => (
                <tr key={teacher.id} className="border-b border-border last:border-0 hover:bg-background/40">
                  <td className="px-5 py-3 font-semibold text-foreground">{teacher.name}</td>
                  <td className="px-5 py-3 text-foreground/70">{teacher.school || "—"}</td>
                  <td className="px-5 py-3 text-foreground/70">{teacher.phone || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-foreground/60">{formatDate(teacher.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
