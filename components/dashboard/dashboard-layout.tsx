"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  PlusCircle,
  Receipt,
  Settings,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

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
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

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
      {mobileNavigationOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-sidebar/35 md:hidden print:hidden"
          onClick={() => setMobileNavigationOpen(false)}
        />
      )}

      <aside
        id="application-navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar transition-transform duration-200 motion-reduce:transition-none md:translate-x-0 print:hidden ${
          mobileNavigationOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-16 items-center justify-between px-5 md:px-6">
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground-active">
            {appName}
          </span>
          <button
            type="button"
            aria-label="Close navigation"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:hidden"
            onClick={() => setMobileNavigationOpen(false)}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Application navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {navItems.map((item) => {
            const isActive = item.href === activeItem?.href;
            const Icon = ICONS[item.icon];
            return (
              <div key={item.href} className="relative">
                {isActive && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-accent" />}
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileNavigationOpen(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
                    isActive
                      ? "bg-white/[0.08] font-semibold text-sidebar-foreground-active"
                      : "text-sidebar-foreground hover:bg-white/5 hover:text-sidebar-foreground-active"
                  }`}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-sidebar-foreground-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            >
              <LogOut size={18} strokeWidth={2} aria-hidden="true" />
              <span>Log out</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col md:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-sm print:hidden md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              aria-label="Open navigation"
              aria-controls="application-navigation"
              aria-expanded={mobileNavigationOpen}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground md:text-lg">{pageTitle}</h1>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-right leading-tight">
              <p className="hidden truncate text-sm font-semibold text-foreground sm:block">{userName}</p>
              {userSubtitle && <p className="hidden truncate text-xs font-normal text-foreground/65 sm:block">{userSubtitle}</p>}
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold tracking-tight text-white">
              {initials || "?"}
            </div>
          </div>
        </header>

        <main id="main-content" className="min-w-0 flex-1 bg-background px-4 py-6 print:bg-white print:p-0 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[90rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
