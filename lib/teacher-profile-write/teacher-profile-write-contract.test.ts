import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "../db/config.ts";
import { SupabaseTeacherProfileWriteRepository } from "./supabase.ts";

function fakeClient(response: { error?: unknown } = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = { from(table: string) {
    calls.push(["from", table]);
    const query = {
      update(...args: unknown[]) { calls.push(["update", ...args]); return query; },
      eq(...args: unknown[]) { calls.push(["eq", ...args]); return Promise.resolve(response); },
    };
    return query;
  }};
  return { client: client as unknown as SupabaseClient, calls };
}

test("teacher-profile-write backend remains environment-only with Supabase default", () => {
  const previous = process.env.DATABASE_BACKEND;
  delete process.env.DATABASE_BACKEND;
  assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "supabase";
  assert.equal(getDatabaseBackendName(), "supabase");
  process.env.DATABASE_BACKEND = "postgres";
  assert.equal(getDatabaseBackendName(), "postgres");
  process.env.DATABASE_BACKEND = "browser";
  assert.throws(() => getDatabaseBackendName(), /supabase or postgres/);
  if (previous === undefined) delete process.env.DATABASE_BACKEND;
  else process.env.DATABASE_BACKEND = previous;
});

test("Supabase teacher profile update preserves exact payload and Auth user predicate", async () => {
  const { client, calls } = fakeClient();
  const repository = new SupabaseTeacherProfileWriteRepository(client, "auth-user");
  await repository.updateProfile({ name: "Teacher Name", school: null, phone: "254700000000" });
  assert.deepEqual(calls, [
    ["from", "teachers"],
    ["update", { name: "Teacher Name", school: null, phone: "254700000000" }],
    ["eq", "user_id", "auth-user"],
  ]);
});

test("Supabase teacher profile write sanitizes database failures", async () => {
  const { client } = fakeClient({ error: { code: "42501", message: "private policy detail" } });
  await assert.rejects(
    () => new SupabaseTeacherProfileWriteRepository(client, "auth-user").updateProfile({
      name: "Teacher Name", school: "School", phone: null,
    }),
    /^Error: Teacher profile write failed\.$/
  );
});

test("profile boundary preserves validated Auth identity, teacher-only role, validation, and UI results", async () => {
  const root = new URL("../../", import.meta.url);
  const [factory, postgres, action, schema] = await Promise.all([
    readFile(new URL("lib/teacher-profile-write/index.ts", root), "utf8"),
    readFile(new URL("lib/teacher-profile-write/postgres.ts", root), "utf8"),
    readFile(new URL("app/actions/auth.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/20260816200000_security_pass_a_lock_server_mutations.sql", root), "utf8"),
  ]);
  assert.match(factory, /^import "server-only";/);
  assert.match(factory, /getCurrentIdentityContext\(\)/);
  assert.match(factory, /identity\.repository\.resolveRole\(\) !== "teacher"/);
  assert.match(factory, /PostgresTeacherProfileWriteRepository\(identity\.user\.id\)/);
  assert.match(postgres, /withAuthenticatedTransaction/);
  assert.match(postgres, /where user_id = \$1::uuid/);
  assert.doesNotMatch(factory + postgres, /withTrustedTransaction|service_role|getPostgresPool|bypassrls|returning \*/i);
  assert.doesNotMatch(action, /\.from\("teachers"\)/);
  assert.match(action, /String\(formData\.get\("name"\)[\s\S]*\.trim\(\)/);
  assert.match(action, /name\.length < 2/);
  assert.match(action, /name\.length > 100 \|\| school\.length > 160 \|\| phone\.length > 30/);
  assert.match(action, /school: school \|\| null/);
  assert.match(action, /phone: phone \|\| null/);
  assert.match(action, /Your session has expired\. Please log in again\./);
  assert.match(action, /Only teacher profiles can be updated here\./);
  assert.match(action, /Could not update your profile\. Please try again\./);
  assert.match(action, /Profile updated successfully\./);
  assert.doesNotMatch(action, /revalidatePath/);
  assert.match(schema, /grant update \(name, school, phone\) on public\.teachers to authenticated/);
});
