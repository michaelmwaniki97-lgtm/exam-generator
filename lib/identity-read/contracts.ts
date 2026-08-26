import type { UserRole } from "../auth/session.ts";

export type TeacherIdentity = { id: string };
export type AdminIdentity = { id: string };
export type TeacherHeaderProfile = { name: string; school: string | null };
export type TeacherProfile = TeacherHeaderProfile & { phone: string | null };
export type AdminDisplayProfile = { name: string };
export type AdminTeacherProfile = {
  id: string;
  name: string;
  school: string | null;
  phone: string | null;
  created_at: string;
};

export interface IdentityReadRepository {
  getTeacherIdentity(): Promise<TeacherIdentity | null>;
  getAdminIdentity(): Promise<AdminIdentity | null>;
  resolveRole(): Promise<UserRole | null>;
  getTeacherHeaderProfile(): Promise<TeacherHeaderProfile | null>;
  getTeacherProfile(): Promise<TeacherProfile | null>;
  getAdminDisplayProfile(): Promise<AdminDisplayProfile | null>;
  countTeachersForAdmin(): Promise<number>;
  listTeachersForAdmin(): Promise<AdminTeacherProfile[]>;
}
