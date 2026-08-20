import type { UserRole } from "@/lib/auth/session";

export type ProtectedArea = "admin" | "teacher";

export function homeForRole(role: UserRole): "/admin" | "/teacher/dashboard" {
  return role === "admin" ? "/admin" : "/teacher/dashboard";
}

export function canAccessArea(role: UserRole | null, area: ProtectedArea): boolean {
  return role === area;
}

export function isAdminRole(role: UserRole | null): role is "admin" {
  return role === "admin";
}
