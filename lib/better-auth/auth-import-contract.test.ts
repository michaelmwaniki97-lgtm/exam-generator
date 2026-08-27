import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");

test("Phase 6 keeps Better Auth scrypt for new passwords while accepting imported Supabase bcrypt", async () => {
  const [options, migration, adapter, upgrade] = await Promise.all([
    source("lib/better-auth/options.ts"),
    source("lib/better-auth/password-migration.ts"),
    source("lib/auth-backend/better-auth.ts"),
    source("lib/better-auth/credential-upgrade.ts"),
  ]);

  assert.match(options, /password:\s*\{[\s\S]*hash: hashMigrationPassword[\s\S]*verify: verifyMigrationPassword/);
  assert.match(migration, /import \{ hashPassword, verifyPassword \} from "better-auth\/crypto"/);
  assert.match(migration, /isSupabaseBcryptHash\(input\.hash\)[\s\S]*bcrypt\.compare/);
  assert.match(migration, /isBetterAuthScryptHash\(input\.hash\)/);
  assert.match(migration, /verifyPassword\(input\)/);
  assert.match(adapter, /upgradeImportedCredentialHashIfNeeded\(user\.id, input\.password\)/);
  assert.match(upgrade, /and password = \$3/);
  assert.match(upgrade, /hashMigrationPassword\(password\)/);
  assert.doesNotMatch(adapter + upgrade, /console\.(?:log|debug|info)\([^\n]*(?:password|hash)/i);
});

test("offline auth importer preserves UUIDs and refuses to create or rewrite application identity", async () => {
  const [importer, script, gitignore] = await Promise.all([
    source("lib/better-auth/import.ts"),
    source("scripts/import-supabase-auth-export.ts"),
    source(".gitignore"),
  ]);

  assert.match(importer, /select email from auth\.users where id = \$1::uuid/);
  assert.match(importer, /insert into better_auth\.users[\s\S]*\(id, name, email, email_verified/);
  assert.match(importer, /insert into better_auth\.accounts[\s\S]*'local:credential'[\s\S]*'credential'/);
  assert.match(importer, /isSupabaseBcryptHash\(record\.encrypted_password\)/);
  assert.match(importer, /upgradedCredentialsPreserved/);
  assert.doesNotMatch(importer, /insert into auth\.users|update auth\.users|delete from auth\.users/i);
  assert.doesNotMatch(importer, /randomUUID\(|crypto\.randomUUID/);
  assert.match(script, /mode: apply \? "apply" : "dry-run"/);
  assert.match(script, /counts only/i);
  assert.match(gitignore, /\*\.auth-export\.jsonl/);
});

test("auth import readiness covers every application UUID dependency before FK cutover", async () => {
  const [importer, migration] = await Promise.all([
    source("lib/better-auth/import.ts"),
    source("infra/self-hosted/auth/30-auth-import-readiness.sql"),
  ]);

  assert.match(importer, /from auth\.users a left join better_auth\.users b on b\.id = a\.id/);
  assert.match(importer, /from teachers t left join better_auth\.users b on b\.id = t\.user_id/);
  assert.match(importer, /from admins a left join better_auth\.users b on b\.id = a\.user_id/);
  assert.match(importer, /from textbook_documents d left join better_auth\.users b on b\.id = d\.uploaded_by/);
  assert.match(migration, /unique index if not exists better_auth_users_lower_email_key/);
  assert.doesNotMatch(migration, /alter table public\.(teachers|admins|textbook_documents)/i);
});

test("Phase 6 remains an offline staging rehearsal with no production connector or Supabase API calls", async () => {
  const [script, importer] = await Promise.all([
    source("scripts/import-supabase-auth-export.ts"),
    source("lib/better-auth/import.ts"),
  ]);

  assert.match(script, /DATABASE_URL is required for the target self-hosted PostgreSQL database/);
  assert.doesNotMatch(script + importer, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE|createClient\(|supabase\.auth|fetch\(/i);
  assert.doesNotMatch(script + importer, /encrypted_password[^\n]*console|console[^\n]*encrypted_password/i);
});
