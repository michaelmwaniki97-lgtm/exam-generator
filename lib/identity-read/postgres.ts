import "server-only";

import type { PoolClient } from "pg";
import type { UserRole } from "../auth/session.ts";
import { queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type {
  AdminDisplayProfile, AdminIdentity, AdminTeacherProfile, IdentityReadRepository,
  TeacherHeaderProfile, TeacherIdentity, TeacherProfile,
} from "./contracts.ts";

function one<Row>(rows: Row[]): Row | null {
  if (rows.length > 1) throw new Error("Identity lookup returned multiple profiles.");
  return rows[0] ?? null;
}

export class PostgresIdentityReadRepository implements IdentityReadRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }
  private run<T>(work: (client: PoolClient) => Promise<T>): Promise<T> { return withAuthenticatedTransaction(this.userId, work); }
  getTeacherIdentity(): Promise<TeacherIdentity | null> { return this.run(async (client) => one(await queryRows<TeacherIdentity>(client,
    "select id from public.teachers where user_id = $1::uuid", [this.userId]))); }
  getAdminIdentity(): Promise<AdminIdentity | null> { return this.run(async (client) => one(await queryRows<AdminIdentity>(client,
    "select id from public.admins where user_id = $1::uuid", [this.userId]))); }
  resolveRole(): Promise<UserRole | null> { return this.run(async (client) => {
    const admin = one(await queryRows<AdminIdentity>(client, "select id from public.admins where user_id = $1::uuid", [this.userId]));
    const teacher = one(await queryRows<TeacherIdentity>(client, "select id from public.teachers where user_id = $1::uuid", [this.userId]));
    return admin ? "admin" : teacher ? "teacher" : null;
  }); }
  getTeacherHeaderProfile(): Promise<TeacherHeaderProfile | null> { return this.run(async (client) => one(await queryRows<TeacherHeaderProfile>(client,
    "select name, school from public.teachers where user_id = $1::uuid", [this.userId]))); }
  getTeacherProfile(): Promise<TeacherProfile | null> { return this.run(async (client) => one(await queryRows<TeacherProfile>(client,
    "select name, school, phone from public.teachers where user_id = $1::uuid", [this.userId]))); }
  getAdminDisplayProfile(): Promise<AdminDisplayProfile | null> { return this.run(async (client) => one(await queryRows<AdminDisplayProfile>(client,
    "select name from public.admins where user_id = $1::uuid", [this.userId]))); }
  private runAdmin<T>(work: (client: PoolClient) => Promise<T>): Promise<T> { return this.run(async (client) => {
    const allowed = one(await queryRows<{ allowed: boolean }>(client, "select public.is_admin() as allowed", []));
    if (!allowed?.allowed) throw new Error("Administrator access is required.");
    return work(client);
  }); }
  countTeachersForAdmin(): Promise<number> { return this.runAdmin(async (client) => Number((await queryRows<{ count: string }>(client,
    "select count(*)::text as count from public.teachers", []))[0]?.count ?? 0)); }
  listTeachersForAdmin(): Promise<AdminTeacherProfile[]> { return this.runAdmin((client) => queryRows<AdminTeacherProfile>(client,
    "select id, name, school, phone, created_at from public.teachers order by created_at desc", [])); }
}
