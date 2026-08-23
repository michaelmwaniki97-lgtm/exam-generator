import Link from "next/link";
import {
  Users,
  FileText,
  BookOpen,
  Wallet,
  GraduationCap,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const managementAreas: {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}[] = [
  {
    label: "Teachers",
    description: "View and manage registered teacher accounts.",
    href: "/admin/teachers",
    icon: Users,
  },
  {
    label: "Subjects",
    description: "Manage the list of subjects available across grades.",
    href: "/admin/subjects",
    icon: BookOpen,
  },
  {
    label: "Grades",
    description: "Manage grade and form levels, PP1 through Form 4.",
    href: "/admin/grades",
    icon: GraduationCap,
  },
  {
    label: "Curriculum",
    description: "Manage strands, sub-strands, and learning outcomes.",
    href: "/admin/curriculum",
    icon: Library,
  },
  {
    label: "Settings",
    description: "Configure exam pricing and other app-wide settings.",
    href: "/admin/settings",
    icon: Settings,
  },
];

function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

export default async function AdminPage() {
  const supabase = await createClient();

  // RLS (teachers_admin_select / exams_admin_select / subjects_select_all /
  // payments_admin_select) already scopes these to what an admin can see -
  // head:true + count:"exact" gets a row count without fetching rows.
  const [{ count: teacherCount }, { count: examCount }, { count: subjectCount }, { data: payments }] =
    await Promise.all([
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      supabase.from("exams").select("id", { count: "exact", head: true }),
      supabase.from("subjects").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("amount").eq("status", "paid"),
    ]);

  const revenue = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const stats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Total Teachers", value: String(teacherCount ?? 0), icon: Users },
    { label: "Total Exams", value: String(examCount ?? 0), icon: FileText },
    { label: "Subjects", value: String(subjectCount ?? 0), icon: BookOpen },
    { label: "Revenue", value: formatKes(revenue), icon: Wallet },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                <stat.icon size={20} strokeWidth={1.75} className="text-accent" />
              </div>
              <span className="text-sm font-normal text-foreground/60">{stat.label}</span>
            </div>
            <p className="mt-4 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-4 text-base font-semibold text-foreground">Manage</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {managementAreas.map((area) => (
            <Link
              key={area.href}
              href={area.href}
              className="rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-accent/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                <area.icon size={20} strokeWidth={1.75} className="text-accent" />
              </div>
              <p className="mt-4 font-semibold text-foreground">{area.label}</p>
              <p className="mt-1 text-sm font-normal text-foreground/60">{area.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
