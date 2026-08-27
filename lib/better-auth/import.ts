import "server-only";

import type { Pool, PoolClient } from "pg";
import { isBetterAuthScryptHash, isSupabaseBcryptHash } from "./password-migration.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SupabaseAuthExportRecord = {
  id: string;
  email: string;
  encrypted_password: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  raw_user_meta_data?: Record<string, unknown> | null;
};

export type AuthImportSummary = {
  total: number;
  insertedUsers: number;
  insertedCredentials: number;
  existingUsers: number;
  existingCredentials: number;
  upgradedCredentialsPreserved: number;
};

export type AuthCutoverReadiness = {
  authUsersMissingBetterAuth: number;
  betterAuthUsersMissingAuth: number;
  emailMismatches: number;
  teachersMissingBetterAuth: number;
  adminsMissingBetterAuth: number;
  textbookDocumentsMissingBetterAuth: number;
};

function normalizedEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Auth import row has no email.");
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !email.includes("@")) {
    throw new Error("Auth import row has an invalid email.");
  }
  return email;
}

function safeDate(value: unknown, field: string): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Auth import row has no ${field}.`);
  }
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new Error(`Auth import row has an invalid ${field}.`);
  return result;
}

function importedName(record: SupabaseAuthExportRecord, email: string): string {
  const metadata = record.raw_user_meta_data;
  for (const key of ["name", "full_name", "fullName"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 200);
  }
  return email;
}

export function normalizeSupabaseAuthExportRecord(record: SupabaseAuthExportRecord) {
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!UUID_PATTERN.test(id)) throw new Error("Auth import row has an invalid UUID.");

  const email = normalizedEmail(record.email);
  if (!isSupabaseBcryptHash(record.encrypted_password)) {
    throw new Error(`Auth import cannot migrate unsupported password material for user ${id}.`);
  }

  const createdAt = safeDate(record.created_at, "created_at");
  const updatedAt = record.updated_at ? safeDate(record.updated_at, "updated_at") : createdAt;

  return {
    id,
    email,
    passwordHash: record.encrypted_password,
    emailVerified: Boolean(record.email_confirmed_at || record.confirmed_at),
    name: importedName(record, email),
    createdAt,
    updatedAt,
  };
}

async function requireMatchingApplicationIdentity(
  client: PoolClient,
  user: ReturnType<typeof normalizeSupabaseAuthExportRecord>,
): Promise<void> {
  const mirror = (await client.query<{ email: string | null }>(
    "select email from auth.users where id = $1::uuid",
    [user.id],
  )).rows[0];
  if (!mirror) {
    throw new Error(`Auth import target is missing the preserved application UUID ${user.id}.`);
  }
  if (normalizedEmail(mirror.email) !== user.email) {
    throw new Error(`Auth import email mismatch for preserved UUID ${user.id}.`);
  }
}

async function importOne(
  client: PoolClient,
  record: SupabaseAuthExportRecord,
  summary: AuthImportSummary,
  dryRun: boolean,
): Promise<void> {
  const user = normalizeSupabaseAuthExportRecord(record);
  await requireMatchingApplicationIdentity(client, user);

  const byId = (await client.query<{ id: string; email: string }>(
    "select id, email from better_auth.users where id = $1::uuid",
    [user.id],
  )).rows[0];
  const byEmail = (await client.query<{ id: string; email: string }>(
    "select id, email from better_auth.users where lower(email) = $1 limit 1",
    [user.email],
  )).rows[0];

  if (byId && normalizedEmail(byId.email) !== user.email) {
    throw new Error(`Better Auth UUID ${user.id} is already bound to another email.`);
  }
  if (byEmail && byEmail.id !== user.id) {
    throw new Error(`Better Auth email ${user.email} is already bound to another UUID.`);
  }

  if (byId) {
    summary.existingUsers += 1;
  } else {
    summary.insertedUsers += 1;
    if (!dryRun) {
      await client.query(
        `insert into better_auth.users
           (id, name, email, email_verified, created_at, updated_at)
         values ($1::uuid, $2, $3, $4, $5, $6)`,
        [user.id, user.name, user.email, user.emailVerified, user.createdAt, user.updatedAt],
      );
    }
  }

  const account = (await client.query<{
    issuer: string;
    account_id: string;
    provider_id: string;
    password: string | null;
  }>(
    `select issuer, account_id, provider_id, password
       from better_auth.accounts
      where user_id = $1::uuid and provider_id = 'credential'
      limit 1`,
    [user.id],
  )).rows[0];

  if (account) {
    if (account.issuer !== "local:credential" || account.account_id !== user.id) {
      throw new Error(`Better Auth credential identity is inconsistent for UUID ${user.id}.`);
    }
    if (account.password === user.passwordHash) {
      summary.existingCredentials += 1;
      return;
    }
    if (account.password && isBetterAuthScryptHash(account.password)) {
      // A previous successful login may already have upgraded this credential
      // to Better Auth's scrypt. Never overwrite it with the stale export hash.
      summary.upgradedCredentialsPreserved += 1;
      return;
    }
    throw new Error(`Better Auth credential hash conflict for UUID ${user.id}.`);
  }

  summary.insertedCredentials += 1;
  if (!dryRun) {
    await client.query(
      `insert into better_auth.accounts
         (id, user_id, issuer, account_id, provider_id, password, created_at, updated_at)
       values (gen_random_uuid(), $1::uuid, 'local:credential', $2, 'credential', $3, $4, $5)`,
      [user.id, user.id, user.passwordHash, user.createdAt, user.updatedAt],
    );
  }
}

export async function importSupabaseAuthExport(
  pool: Pool,
  records: SupabaseAuthExportRecord[],
  options: { dryRun?: boolean } = {},
): Promise<AuthImportSummary> {
  const dryRun = options.dryRun !== false;
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  for (const record of records) {
    const normalized = normalizeSupabaseAuthExportRecord(record);
    if (seenIds.has(normalized.id)) throw new Error(`Auth export repeats UUID ${normalized.id}.`);
    if (seenEmails.has(normalized.email)) throw new Error(`Auth export repeats email ${normalized.email}.`);
    seenIds.add(normalized.id);
    seenEmails.add(normalized.email);
  }

  const client = await pool.connect();
  const summary: AuthImportSummary = {
    total: records.length,
    insertedUsers: 0,
    insertedCredentials: 0,
    existingUsers: 0,
    existingCredentials: 0,
    upgradedCredentialsPreserved: 0,
  };

  try {
    await client.query("begin");
    for (const record of records) await importOne(client, record, summary, dryRun);
    if (dryRun) await client.query("rollback");
    else await client.query("commit");
    return summary;
  } catch (error) {
    try { await client.query("rollback"); } catch { /* preserve original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function getAuthCutoverReadiness(pool: Pool): Promise<AuthCutoverReadiness> {
  const result = (await pool.query<AuthCutoverReadiness>(
    `select
       (select count(*)::int from auth.users a left join better_auth.users b on b.id = a.id where b.id is null) as "authUsersMissingBetterAuth",
       (select count(*)::int from better_auth.users b left join auth.users a on a.id = b.id where a.id is null) as "betterAuthUsersMissingAuth",
       (select count(*)::int from auth.users a join better_auth.users b on b.id = a.id where lower(coalesce(a.email, '')) <> lower(b.email)) as "emailMismatches",
       (select count(*)::int from teachers t left join better_auth.users b on b.id = t.user_id where b.id is null) as "teachersMissingBetterAuth",
       (select count(*)::int from admins a left join better_auth.users b on b.id = a.user_id where b.id is null) as "adminsMissingBetterAuth",
       (select count(*)::int from textbook_documents d left join better_auth.users b on b.id = d.uploaded_by where b.id is null) as "textbookDocumentsMissingBetterAuth"`,
  )).rows[0];
  return result;
}

export function authCutoverReadinessIsClean(result: AuthCutoverReadiness): boolean {
  return Object.values(result).every((value) => value === 0);
}
