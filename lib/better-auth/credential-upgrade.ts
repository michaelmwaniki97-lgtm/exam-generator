import "server-only";

import { hashMigrationPassword, isSupabaseBcryptHash } from "./password-migration.ts";
import { getBetterAuthPool } from "./pool.ts";

/**
 * After Better Auth has already authenticated an imported bcrypt credential,
 * opportunistically replace that exact hash with Better Auth's scrypt format.
 * The compare-and-swap predicate prevents a concurrent reset/change from being
 * overwritten by a stale login attempt.
 */
export async function upgradeImportedCredentialHashIfNeeded(
  userId: string,
  password: string,
): Promise<boolean> {
  const pool = getBetterAuthPool();
  const account = (await pool.query<{ password: string | null }>(
    `select password
       from better_auth.accounts
      where user_id = $1::uuid and provider_id = 'credential'
      limit 1`,
    [userId],
  )).rows[0];

  const currentHash = account?.password ?? "";
  if (!isSupabaseBcryptHash(currentHash)) return false;

  const upgradedHash = await hashMigrationPassword(password);
  const result = await pool.query(
    `update better_auth.accounts
        set password = $1, updated_at = now()
      where user_id = $2::uuid
        and provider_id = 'credential'
        and password = $3`,
    [upgradedHash, userId, currentHash],
  );
  return result.rowCount === 1;
}
