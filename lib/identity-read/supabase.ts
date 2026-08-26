import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "../auth/session.ts";
import type {
  AdminDisplayProfile,
  AdminIdentity,
  AdminTeacherProfile,
  IdentityReadRepository,
  TeacherHeaderProfile,
  TeacherIdentity,
  TeacherProfile,
} from "./contracts.ts";

function fail(): never { throw new Error("Could not load identity profile."); }

export class SupabaseIdentityReadRepository implements IdentityReadRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;
  constructor(client: SupabaseClient, userId: string) { this.client = client; this.userId = userId; }

  async getTeacherIdentity(): Promise<TeacherIdentity | null> {
    const { data, error } = await this.client.from("teachers").select("id").eq("user_id", this.userId).maybeSingle();
    if (error) fail(); return data;
  }
  async getAdminIdentity(): Promise<AdminIdentity | null> {
    const { data, error } = await this.client.from("admins").select("id").eq("user_id", this.userId).maybeSingle();
    if (error) fail(); return data;
  }
  async resolveRole(): Promise<UserRole | null> {
    const [admin, teacher] = await Promise.all([this.getAdminIdentity(), this.getTeacherIdentity()]);
    return admin ? "admin" : teacher ? "teacher" : null;
  }
  async getTeacherHeaderProfile(): Promise<TeacherHeaderProfile | null> {
    const { data, error } = await this.client.from("teachers").select("name, school").eq("user_id", this.userId).maybeSingle();
    if (error) fail(); return data;
  }
  async getTeacherProfile(): Promise<TeacherProfile | null> {
    const { data } = await this.client.from("teachers").select("name, school, phone").eq("user_id", this.userId).single();
    return data;
  }
  async getAdminDisplayProfile(): Promise<AdminDisplayProfile | null> {
    const { data, error } = await this.client.from("admins").select("name").eq("user_id", this.userId).maybeSingle();
    if (error) fail(); return data;
  }
  private async requireAdmin(): Promise<void> { if (!await this.getAdminIdentity()) throw new Error("Administrator access is required."); }
  async countTeachersForAdmin(): Promise<number> {
    await this.requireAdmin();
    const { count, error } = await this.client.from("teachers").select("id", { count: "exact", head: true });
    if (error) fail(); return count ?? 0;
  }
  async listTeachersForAdmin(): Promise<AdminTeacherProfile[]> {
    await this.requireAdmin();
    const { data, error } = await this.client.from("teachers").select("id, name, school, phone, created_at").order("created_at", { ascending: false });
    if (error) fail(); return data ?? [];
  }
}
