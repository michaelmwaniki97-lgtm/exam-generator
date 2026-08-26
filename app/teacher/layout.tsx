import { redirect } from "next/navigation";
import { getCurrentUser, getUserRole } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { getIdentityReadRepository } from "@/lib/identity-read";
import { DashboardLayout, type NavItem } from "@/components/dashboard/dashboard-layout";

export const maxDuration = 300;

const teacherNavItems: NavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: "layout-dashboard" },
  { label: "My Exams", href: "/teacher/exams", icon: "file-text" },
  { label: "Create Exam", href: "/teacher/exams/new", icon: "plus-circle" },
  { label: "Transactions", href: "/teacher/transactions", icon: "receipt" },
  { label: "Profile", href: "/teacher/profile", icon: "user" },
];

export default async function TeacherLayout({ children }: LayoutProps<"/teacher">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = await getUserRole();
  if (role === "admin") redirect("/admin");
  if (!role) redirect("/login");

  const teacher = await (await getIdentityReadRepository()).getTeacherHeaderProfile();

  return (
    <DashboardLayout
      appName="Exam Generator"
      navItems={teacherNavItems}
      userName={teacher?.name ?? user.email ?? "Teacher"}
      userSubtitle={teacher?.school ?? undefined}
      logoutAction={logout}
    >
      {children}
    </DashboardLayout>
  );
}
