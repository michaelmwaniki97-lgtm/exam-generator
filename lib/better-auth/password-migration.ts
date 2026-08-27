/**
 * Phase-1 password migration helpers.
 *
 * Better Auth uses scrypt for new email/password credentials by default.
 * Existing Supabase credentials are bcrypt hashes, so cutover must install a
 * bcrypt verifier and explicitly test it before any real user import.
 */
export function isSupabaseBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
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
