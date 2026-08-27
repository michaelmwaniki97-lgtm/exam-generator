import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseIdentityReadRepository } from "./supabase.ts";

type Response = { data?: unknown; count?: number | null; error?: unknown };
function fakeClient(responses: Response[]) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]); const response = responses.shift() ?? { data: null };
    const query = {
      select(...args: unknown[]) { calls.push(["select", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return query; },
      maybeSingle() { calls.push(["maybeSingle"]); return Promise.resolve(response); },
      single() { calls.push(["single"]); return Promise.resolve(response); },
      order(...args: unknown[]) { calls.push(["order", ...args]); return Promise.resolve(response); },
      then(resolve: (value: Response) => unknown) { return Promise.resolve(response).then(resolve); },
    }; return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("identity backend remains environment-only with Supabase default", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase"; assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres"; assert.equal(getDatabaseBackendName(), "postgres");
  if (previous === undefined) delete process.env.DATABASE_BACKEND; else process.env.DATABASE_BACKEND = previous;
});

test("Supabase identity contracts preserve projections, self filter, nulls, and admin precedence", async () => {
  const { client, calls } = fakeClient([
    { data: { id: "teacher" } }, { data: { id: "admin" } },
    { data: { id: "admin" } }, { data: { id: "teacher" } },
    { data: { name: "Teacher", school: null } },
    { data: { name: "Teacher", school: null, phone: null } },
    { data: { name: "Admin" } },
    { data: { id: "admin" } }, { count: 4 },
    { data: { id: "admin" } }, { data: [{ id: "teacher", name: "Teacher", school: null, phone: null, created_at: "2026-01-01" }] },
  ]);
  const repository = new SupabaseIdentityReadRepository(client, "auth-user");
  assert.deepEqual(await repository.getTeacherIdentity(), { id: "teacher" });
  assert.deepEqual(await repository.getAdminIdentity(), { id: "admin" });
  assert.equal(await repository.resolveRole(), "admin");
  assert.deepEqual(await repository.getTeacherHeaderProfile(), { name: "Teacher", school: null });
  assert.deepEqual(await repository.getTeacherProfile(), { name: "Teacher", school: null, phone: null });
  assert.deepEqual(await repository.getAdminDisplayProfile(), { name: "Admin" });
  assert.equal(await repository.countTeachersForAdmin(), 4);
  assert.equal((await repository.listTeachersForAdmin()).length, 1);
  assert.ok(calls.filter((call) => call[0] === "eq").every((call) => call[1] === "user_id" && call[2] === "auth-user"));
  assert.ok(calls.some((call) => call[0] === "single"));
  assert.ok(calls.some((call) => call[0] === "order" && call[1] === "created_at" && (call[2] as { ascending: boolean }).ascending === false));
});

test("Supabase identity missing and cross-role results remain null", async () => {
  const { client } = fakeClient([{ data: null }, { data: null }, { data: null }, { data: null }]);
  const repository = new SupabaseIdentityReadRepository(client, "unknown");
  assert.equal(await repository.getTeacherIdentity(), null);
  assert.equal(await repository.getAdminIdentity(), null);
  assert.equal(await repository.resolveRole(), null);
});

test("identity boundary is server-only and accepts no browser identity, role, or backend", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, session, authAction] = await Promise.all([
    readFile(new URL("lib/identity-read/index.ts", root), "utf8"),
    readFile(new URL("lib/identity-read/postgres.ts", root), "utf8"),
    readFile(new URL("lib/auth/session.ts", root), "utf8"),
    readFile(new URL("app/actions/auth.ts", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentAuthUser\(\)/);
  assert.match(factory, /PostgresIdentityReadRepository\(user\.id\)/);
  assert.match(session, /repository\.resolveRole\(\)/);
  assert.doesNotMatch(factory + postgres, /request\.json|formData|searchParams|service_role|withTrustedTransaction|getPostgresPool|bypassrls/i);
  assert.doesNotMatch(factory, /userId\s*:/);
  assert.match(authAction, /signupWithConfiguredBackend/); assert.match(authAction, /loginWithConfiguredBackend/);
  assert.match(authAction, /logoutWithConfiguredBackend/); assert.match(authAction, /auth\.resetPasswordForEmail/);
});

test("teacher and admin user_id uniqueness and admin-first precedence remain documented in schema/code", async () => {
  const root = new URL("../../", import.meta.url);
  const [schema, adapter] = await Promise.all([
    readFile(new URL("supabase/migrations/20260811150000_init_schema.sql", root), "utf8"),
    readFile(new URL("lib/identity-read/supabase.ts", root), "utf8"),
  ]);
  assert.match(schema, /teachers[\s\S]*?user_id uuid not null unique/);
  assert.match(schema, /admins[\s\S]*?user_id uuid not null unique/);
  assert.match(adapter, /return admin \? "admin" : teacher \? "teacher" : null/);
});
