import bcrypt from "bcrypt";
import { hashPassword, verifyPassword } from "better-auth/crypto";

/**
 * Password compatibility for Supabase -> Better Auth migration.
 *
 * Existing Supabase email/password credentials are bcrypt. Better Auth uses
 * scrypt by default. Keep Better Auth's scrypt for every newly-created/reset
 * password while accepting only recognized bcrypt hashes during the migration
 * window. Successful imported logins are upgraded to scrypt separately.
 */
export function isSupabaseBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
}

export function isBetterAuthScryptHash(hash: string): boolean {
  return /^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(hash);
}

export type LegacyBcryptVerifier = (password: string, hash: string) => Promise<boolean>;

export async function verifyImportedSupabasePassword(
  password: string,
  hash: string,
  verifyBcrypt: LegacyBcryptVerifier,
): Promise<boolean> {
  if (!isSupabaseBcryptHash(hash)) return false;
  return verifyBcrypt(password, hash);
}

export async function hashMigrationPassword(password: string): Promise<string> {
  return hashPassword(password);
}

export async function verifyMigrationPassword(input: {
  password: string;
  hash: string;
}): Promise<boolean> {
  if (isSupabaseBcryptHash(input.hash)) {
    return bcrypt.compare(input.password, input.hash);
  }
  if (!isBetterAuthScryptHash(input.hash)) return false;
  try {
    return await verifyPassword(input);
  } catch {
    return false;
  }
}
