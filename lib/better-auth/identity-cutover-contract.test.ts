import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");

test("identity FK cutover is manual/deferred and never part of normal bootstrap", async () => {
  const [compose, bootstrap, cutover] = await Promise.all([
    source("docker-compose.selfhosted.yml"),
    source("infra/self-hosted/bootstrap/10-apply-current-migrations.sh"),
    source("infra/self-hosted/auth-cutover/40-better-auth-identity-cutover.sql"),
  ]);

  assert.match(compose, /infra\/self-hosted\/auth-cutover:\/selfhosted\/auth-cutover:ro/);
  assert.doesNotMatch(bootstrap, /auth-cutover/);
  assert.match(cutover, /MANUAL AUTH CUTOVER ONLY/i);
  assert.match(cutover, /begin;/i);
  assert.match(cutover, /commit;/i);
});

test("cutover fails closed on UUID/email/readiness gaps before changing constraints", async () => {
  const [cutover, importer] = await Promise.all([
    source("infra/self-hosted/auth-cutover/40-better-auth-identity-cutover.sql"),
    source("lib/better-auth/import.ts"),
  ]);

  assert.match(cutover, /from auth\.users a[\s\S]*left join better_auth\.users b on b\.id = a\.id/);
  assert.match(cutover, /from better_auth\.users b[\s\S]*left join auth\.users a on a\.id = b\.id/);
  assert.match(cutover, /lower\(coalesce\(a\.email, ''\)\) <> lower\(b\.email\)/);
  assert.match(cutover, /from public\.teachers t[\s\S]*b\.id = t\.user_id/);
  assert.match(cutover, /from public\.admins a[\s\S]*b\.id = a\.user_id/);
  assert.match(cutover, /from public\.textbook_documents d[\s\S]*b\.id = d\.uploaded_by/);
  assert.match(cutover, /target_ns\.nspname = 'auth'[\s\S]*target\.relname = 'users'/);
  assert.match(cutover, /teachers_user_id_fkey'[\s\S]*confdeltype = 'c'/);
  assert.match(cutover, /admins_user_id_fkey'[\s\S]*confdeltype = 'c'/);
  assert.match(cutover, /textbook_documents_uploaded_by_fkey'[\s\S]*confdeltype = 'r'/);
  assert.match(cutover, /raise exception[\s\S]*Better Auth identity cutover readiness failed/);
  assert.match(importer, /betterAuthUsersMissingAuth: number/);
  assert.match(importer, /from better_auth\.users b left join auth\.users a on a\.id = b\.id/);
});

test("cutover repoints only the three reviewed identity FKs with historical delete semantics", async () => {
  const cutover = await source("infra/self-hosted/auth-cutover/40-better-auth-identity-cutover.sql");

  assert.match(cutover, /alter table public\.teachers[\s\S]*foreign key \(user_id\) references better_auth\.users\(id\)[\s\S]*on delete cascade not valid/);
  assert.match(cutover, /alter table public\.admins[\s\S]*foreign key \(user_id\) references better_auth\.users\(id\)[\s\S]*on delete cascade not valid/);
  assert.match(cutover, /alter table public\.textbook_documents[\s\S]*foreign key \(uploaded_by\) references better_auth\.users\(id\)[\s\S]*on delete restrict not valid/);
  assert.match(cutover, /validate constraint teachers_user_id_fkey/);
  assert.match(cutover, /validate constraint admins_user_id_fkey/);
  assert.match(cutover, /validate constraint textbook_documents_uploaded_by_fkey/);
  assert.doesNotMatch(cutover, /drop table auth\.users|drop schema auth/i);
});

test("post-cutover provisioning stops depending on auth.users while RLS identity stays server-derived", async () => {
  const [bridge, cutover, postgresClient, compatibility] = await Promise.all([
    source("lib/better-auth/application-bridge.ts"),
    source("infra/self-hosted/auth-cutover/40-better-auth-identity-cutover.sql"),
    source("lib/db/postgres-client.ts"),
    source("infra/self-hosted/bootstrap/00-supabase-compatibility.sql"),
  ]);

  assert.match(bridge, /Application identity schema is mid-cutover; refusing Auth provisioning/);
  assert.match(bridge, /anchor === "auth\.users"/);
  assert.match(bridge, /insert into auth\.users \(id, email, raw_user_meta_data\)/);
  assert.match(bridge, /insert into public\.teachers \(user_id, name, school, phone\)/);
  assert.match(bridge, /from better_auth\.users u[\s\S]*join public\.teachers t on t\.user_id = u\.id/);
  assert.match(cutover, /drop trigger if exists on_auth_user_created on auth\.users/);
  assert.match(cutover, /revoke select, insert on table auth\.users from service_role/);
  assert.match(postgresClient, /set local role authenticated/);
  assert.match(postgresClient, /"request\.jwt\.claim\.sub", userId/);
  assert.match(compatibility, /grant usage on schema public, extensions, auth to anon, authenticated, service_role/);
  assert.match(compatibility, /grant execute on function auth\.uid\(\), auth\.role\(\) to anon, authenticated, service_role/);
  assert.match(cutover, /grant usage on schema auth to anon, authenticated, service_role/);
  assert.match(cutover, /grant execute on function auth\.uid\(\), auth\.role\(\) to anon, authenticated, service_role/);
  assert.doesNotMatch(cutover, /grant (?:select|insert|update|delete|all)[^;]*on (?:table )?auth\.users to authenticated/i);
  assert.doesNotMatch(bridge, /formData|searchParams|request\.json|NEXT_PUBLIC_/i);
});
