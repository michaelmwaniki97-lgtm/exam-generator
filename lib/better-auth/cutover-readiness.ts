import "server-only";

import type { Pool } from "pg";
import { passwordResetPageUrl } from "../auth/recovery.ts";
import { getSmtpConfigForEnvironment } from "../email/smtp.ts";

export type BetterAuthTrafficReadiness = Readonly<{
  historicalUsersMissingBetterAuth: number;
  betterAuthUsersMissingHistorical: number;
  normalizedEmailMismatches: number;
  missingTeacherUsers: number;
  missingAdminUsers: number;
  missingUploaderUsers: number;
  reviewedForeignKeys: number;
  legacySignupTriggerPresent: boolean;
  serviceRoleCanReadHistoricalUsers: boolean;
  serviceRoleCanInsertHistoricalUsers: boolean;
  authenticatedCanUseAuthSchema: boolean;
  authenticatedCanExecuteAuthUid: boolean;
}>;

export function assertBetterAuthTrafficEnvironment(
  environment: Record<string, string | undefined>,
): void {
  if ((environment.AUTH_BACKEND ?? "supabase").trim().toLowerCase() !== "better-auth") {
    throw new Error("AUTH_BACKEND=better-auth is required for Better Auth traffic cutover.");
  }
  if ((environment.DATABASE_BACKEND ?? "supabase").trim().toLowerCase() !== "postgres") {
    throw new Error("DATABASE_BACKEND=postgres is required for Better Auth traffic cutover.");
  }
  if (!environment.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for Better Auth traffic cutover.");
  }

  const secret = environment.BETTER_AUTH_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }

  const rawBaseUrl = environment.BETTER_AUTH_URL?.trim();
  if (!rawBaseUrl) throw new Error("BETTER_AUTH_URL is required for Better Auth traffic cutover.");
  const baseUrl = new URL(rawBaseUrl);
  if (!/^https?:$/.test(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.hash) {
    throw new Error("BETTER_AUTH_URL must be a clean HTTP(S) application URL.");
  }
  if (environment.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
  }

  const resetUrl = new URL(passwordResetPageUrl(environment));
  if (resetUrl.origin !== baseUrl.origin) {
    throw new Error("PUBLIC_APP_URL and BETTER_AUTH_URL must use the same origin at cutover.");
  }

  // Password recovery is part of the acceptance boundary, not an optional
  // post-cutover repair. Validate the generic SMTP configuration before traffic
  // is switched so users are never stranded without credential recovery.
  getSmtpConfigForEnvironment(environment);
}

export async function readBetterAuthTrafficReadiness(pool: Pool): Promise<BetterAuthTrafficReadiness> {
  const counts = (await pool.query<{
    historical_users_missing_better_auth: number;
    better_auth_users_missing_historical: number;
    normalized_email_mismatches: number;
    missing_teacher_users: number;
    missing_admin_users: number;
    missing_uploader_users: number;
  }>(`
    select
      (select count(*)::int from auth.users a left join better_auth.users b on b.id = a.id where b.id is null) as historical_users_missing_better_auth,
      (select count(*)::int from better_auth.users b left join auth.users a on a.id = b.id where a.id is null) as better_auth_users_missing_historical,
      (select count(*)::int from auth.users a join better_auth.users b on b.id = a.id where lower(coalesce(a.email, '')) <> lower(b.email)) as normalized_email_mismatches,
      (select count(*)::int from public.teachers t left join better_auth.users b on b.id = t.user_id where b.id is null) as missing_teacher_users,
      (select count(*)::int from public.admins a left join better_auth.users b on b.id = a.user_id where b.id is null) as missing_admin_users,
      (select count(*)::int from public.textbook_documents d left join better_auth.users b on b.id = d.uploaded_by where b.id is null) as missing_uploader_users
  `)).rows[0];

  const fk = (await pool.query<{ reviewed_foreign_keys: number }>(`
    select count(*)::int as reviewed_foreign_keys
      from pg_constraint c
      join pg_class source on source.oid = c.conrelid
      join pg_namespace source_ns on source_ns.oid = source.relnamespace
      join pg_class target on target.oid = c.confrelid
      join pg_namespace target_ns on target_ns.oid = target.relnamespace
     where c.contype = 'f'
       and source_ns.nspname = 'public'
       and target_ns.nspname = 'better_auth'
       and target.relname = 'users'
       and c.convalidated
       and (
         (source.relname = 'teachers' and c.conname = 'teachers_user_id_fkey' and c.confdeltype = 'c')
         or (source.relname = 'admins' and c.conname = 'admins_user_id_fkey' and c.confdeltype = 'c')
         or (source.relname = 'textbook_documents' and c.conname = 'textbook_documents_uploaded_by_fkey' and c.confdeltype = 'r')
       )
  `)).rows[0];

  const controls = (await pool.query<{
    legacy_signup_trigger_present: boolean;
    service_role_can_read_historical_users: boolean;
    service_role_can_insert_historical_users: boolean;
    authenticated_can_use_auth_schema: boolean;
    authenticated_can_execute_auth_uid: boolean;
  }>(`
    select
      exists(
        select 1 from pg_trigger
         where tgrelid = 'auth.users'::regclass
           and tgname = 'on_auth_user_created'
           and not tgisinternal
      ) as legacy_signup_trigger_present,
      has_table_privilege('service_role', 'auth.users', 'SELECT') as service_role_can_read_historical_users,
      has_table_privilege('service_role', 'auth.users', 'INSERT') as service_role_can_insert_historical_users,
      has_schema_privilege('authenticated', 'auth', 'USAGE') as authenticated_can_use_auth_schema,
      has_function_privilege('authenticated', 'auth.uid()', 'EXECUTE') as authenticated_can_execute_auth_uid
  `)).rows[0];

  return {
    historicalUsersMissingBetterAuth: counts?.historical_users_missing_better_auth ?? -1,
    betterAuthUsersMissingHistorical: counts?.better_auth_users_missing_historical ?? -1,
    normalizedEmailMismatches: counts?.normalized_email_mismatches ?? -1,
    missingTeacherUsers: counts?.missing_teacher_users ?? -1,
    missingAdminUsers: counts?.missing_admin_users ?? -1,
    missingUploaderUsers: counts?.missing_uploader_users ?? -1,
    reviewedForeignKeys: fk?.reviewed_foreign_keys ?? -1,
    legacySignupTriggerPresent: controls?.legacy_signup_trigger_present ?? true,
    serviceRoleCanReadHistoricalUsers: controls?.service_role_can_read_historical_users ?? true,
    serviceRoleCanInsertHistoricalUsers: controls?.service_role_can_insert_historical_users ?? true,
    authenticatedCanUseAuthSchema: controls?.authenticated_can_use_auth_schema ?? false,
    authenticatedCanExecuteAuthUid: controls?.authenticated_can_execute_auth_uid ?? false,
  };
}

export function isBetterAuthTrafficReady(readiness: BetterAuthTrafficReadiness): boolean {
  return readiness.historicalUsersMissingBetterAuth === 0
    && readiness.betterAuthUsersMissingHistorical === 0
    && readiness.normalizedEmailMismatches === 0
    && readiness.missingTeacherUsers === 0
    && readiness.missingAdminUsers === 0
    && readiness.missingUploaderUsers === 0
    && readiness.reviewedForeignKeys === 3
    && !readiness.legacySignupTriggerPresent
    && !readiness.serviceRoleCanReadHistoricalUsers
    && !readiness.serviceRoleCanInsertHistoricalUsers
    && readiness.authenticatedCanUseAuthSchema
    && readiness.authenticatedCanExecuteAuthUid;
}

/**
 * Post-acceptance readiness no longer requires every Better Auth user to have a
 * historical auth.users mirror. New users created after acceptance are
 * intentionally Better-Auth-only. Historical coverage, application FK anchors,
 * retired bridge privileges, and RLS compatibility must remain intact.
 */
export function isBetterAuthAcceptedReady(readiness: BetterAuthTrafficReadiness): boolean {
  return readiness.historicalUsersMissingBetterAuth === 0
    && readiness.normalizedEmailMismatches === 0
    && readiness.missingTeacherUsers === 0
    && readiness.missingAdminUsers === 0
    && readiness.missingUploaderUsers === 0
    && readiness.reviewedForeignKeys === 3
    && !readiness.legacySignupTriggerPresent
    && !readiness.serviceRoleCanReadHistoricalUsers
    && !readiness.serviceRoleCanInsertHistoricalUsers
    && readiness.authenticatedCanUseAuthSchema
    && readiness.authenticatedCanExecuteAuthUid;
}
