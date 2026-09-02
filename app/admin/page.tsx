import Link from "next/link";
import {
  ArrowRight,
  Users,
  FileText,
  BookOpen,
  Wallet,
  GraduationCap,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { getCatalogRepository } from "@/lib/catalog";
import { getAdminReportingRepository } from "@/lib/admin-reporting";
import { getIdentityReadRepository } from "@/lib/identity-read";
import { getAdminPaymentReportingRepository } from "@/lib/payment-reporting";

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
  const catalog = await getCatalogRepository();
  const reporting = await getAdminReportingRepository();
  const identity = await getIdentityReadRepository();
  const paymentReporting = await getAdminPaymentReportingRepository();

  // Existing RLS policies scope each read. Teacher/payment reads remain on their
  // current path; reporting counts do not fetch private exam rows.
  const [{ count: teacherCount }, { count: examCount }, subjectCount, revenue] =
    await Promise.all([
      identity.countTeachersForAdmin().then((count) => ({ count })),
      reporting.countDashboardExams().then((count) => ({ count })),
      catalog.countSubjects(),
      paymentReporting.getAdminPaidRevenue(),
    ]);

  const stats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Total Teachers", value: String(teacherCount ?? 0), icon: Users },
    { label: "Total Exams", value: String(examCount ?? 0), icon: FileText },
    { label: "Subjects", value: String(subjectCount ?? 0), icon: BookOpen },
    { label: "Revenue", value: formatKes(revenue), icon: Wallet },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Administration</h2>
        <p className="mt-1 text-sm text-foreground/65">
          Current system totals and management areas.
        </p>
      </div>

      <section aria-labelledby="overview-heading">
        <h3 id="overview-heading" className="mb-3 text-sm font-semibold text-foreground">
          Overview
        </h3>
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`p-4 sm:p-5 ${
                index % 2 === 0 ? "border-r border-border" : ""
              } ${index < 2 ? "border-b border-border lg:border-b-0" : ""} ${
                index > 0 ? "lg:border-l lg:border-border" : ""
              } lg:border-r-0`}
            >
              <dt className="flex items-center gap-2 text-xs font-medium text-foreground/60">
                <stat.icon size={15} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
                {stat.label}
              </dt>
              <dd className="mt-2 font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="manage-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="manage-heading" className="text-sm font-semibold text-foreground">
            Manage
          </h3>
          <span className="text-xs text-foreground/50">{managementAreas.length} areas</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid md:grid-cols-2">
            {managementAreas.map((area, index) => (
              <Link
                key={area.href}
                href={area.href}
                className={`group flex min-h-20 items-center gap-3 border-border px-4 py-3 transition-colors hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
                  index < managementAreas.length - 1 ? "border-b" : ""
                } ${index % 2 === 0 ? "md:border-r" : ""} ${
                  index === managementAreas.length - 2 ? "md:border-b-0" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <area.icon size={18} strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{area.label}</p>
                  <p className="mt-0.5 text-sm leading-5 text-foreground/60">{area.description}</p>
                </div>
                <ArrowRight
                  size={17}
                  className="shrink-0 text-foreground/35 transition-colors group-hover:text-accent"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
