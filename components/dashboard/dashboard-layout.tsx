"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Receipt,
  User,
  Users,
  BookOpen,
  GraduationCap,
  Library,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

// Icons are referenced by name, not passed as component props: Server
// Components (the teacher/admin layouts) can't pass function references
// like a Lucide component across the server/client boundary to this
// Client Component — only plain serializable data survives that boundary.
const ICONS = {
  "layout-dashboard": LayoutDashboard,
  "file-text": FileText,
  "plus-circle": PlusCircle,
  receipt: Receipt,
  user: User,
  users: Users,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  library: Library,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

export function DashboardLayout({
  appName,
  navItems,
  userName,
  userSubtitle,
  logoutAction,
  children,
}: {
  appName: string;
  navItems: NavItem[];
  userName: string;
  userSubtitle?: string;
  logoutAction: () => void | Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();

  // Longest matching href wins, so e.g. "/admin/teachers" is active rather
  // than "/admin" just because it's a path prefix of every admin route.
  const activeItem = navItems.reduce<NavItem | undefined>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    if (!best || item.href.length > best.href.length) return item;
    return best;
  }, undefined);
  const pageTitle = activeItem?.label ?? "Dashboard";

  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-16 flex-col bg-sidebar md:w-64 print:hidden">
        <div className="px-3 py-6 text-center md:px-6 md:text-left">
          <span className="hidden text-lg font-bold tracking-tight text-sidebar-foreground-active md:inline">
            {appName}
          </span>
        </div>

        <nav className="flex-1 space-y-1 py-1">
          {navItems.map((item) => {
            const isActive = item.href === activeItem?.href;
            const Icon = ICONS[item.icon];
            return (
              <div key={item.href} className="relative px-1 md:px-3">
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-accent" />
                )}
                <Link
                  href={item.href}
                  className={`flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors md:justify-start ${
                    isActive
                      ? "bg-white/5 text-sidebar-foreground-active"
                      : "text-sidebar-foreground hover:bg-white/5 hover:text-sidebar-foreground-active"
                  }`}
                >
                  <Icon size={18} strokeWidth={2} />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-sidebar-foreground-active md:justify-start"
            >
              <LogOut size={18} strokeWidth={2} />
              <span className="hidden md:inline">Logout</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col pl-16 md:pl-64 print:pl-0">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 print:hidden md:px-8">
          <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>

          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="hidden text-sm font-semibold text-foreground sm:block">{userName}</p>
              {userSubtitle && (
                <p className="hidden text-xs font-normal text-foreground/60 sm:block">{userSubtitle}</p>
              )}
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold tracking-tight text-white">
              {initials || "?"}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-background px-4 py-5 print:bg-white print:p-0 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
