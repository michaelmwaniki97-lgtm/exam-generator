import { redirect } from "next/navigation";
import { getCurrentUser, getUserRole } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardLayout, type NavItem } from "@/components/dashboard/dashboard-layout";

const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "layout-dashboard" },
  { label: "Teachers", href: "/admin/teachers", icon: "users" },
  { label: "Subjects", href: "/admin/subjects", icon: "book-open" },
  { label: "Grades", href: "/admin/grades", icon: "graduation-cap" },
  { label: "Curriculum", href: "/admin/curriculum", icon: "library" },
  { label: "Textbooks", href: "/admin/textbooks", icon: "book-open" },
  { label: "Settings", href: "/admin/settings", icon: "settings" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = await getUserRole();
  if (role === "teacher") redirect("/teacher/dashboard");
  if (!role) redirect("/login");

  const supabase = await createClient();
  const { data: admin } = await supabase
    .from("admins")
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <DashboardLayout
      appName="Exam Generator"
      navItems={adminNavItems}
      userName={admin?.name ?? user.email ?? "Admin"}
      userSubtitle="Administrator"
      logoutAction={logout}
    >
      {children}
    </DashboardLayout>
  );
}
