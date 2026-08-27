import "server-only";

import { getDatabaseBackendName } from "../db/config.ts";
import { withTrustedTransaction } from "../db/postgres-client.ts";
import { getBetterAuthPool } from "./pool.ts";

export type BetterAuthSignupProfile = Readonly<{
  userId: string;
  email: string;
  name: string;
  school: string;
  phone: string;
}>;

export async function betterAuthEmailAlreadyExists(email: string): Promise<boolean> {
  const result = await getBetterAuthPool().query<{ exists: boolean }>(
    "select exists(select 1 from better_auth.users where lower(email) = lower($1)) as exists",
    [email],
  );
  return result.rows[0]?.exists === true;
}

export async function betterAuthUserWasPersisted(userId: string, email: string): Promise<boolean> {
  const result = await getBetterAuthPool().query<{ exists: boolean }>(
    `select exists(
       select 1 from better_auth.users
       where id = $1::uuid and lower(email) = lower($2)
     ) as exists`,
    [userId, email],
  );
  return result.rows[0]?.exists === true;
}

/**
 * Temporary Auth-migration bridge.
 *
 * Application ownership FKs still reference auth.users, while Better Auth owns
 * its canonical credential/session rows in better_auth.*. Until the explicit
 * FK cutover, mirror only the immutable Better Auth UUID + signup metadata into
 * auth.users. The existing handle_new_user trigger then creates the teacher
 * profile exactly as Supabase signup does today.
 */
export async function betterAuthApplicationIdentityWasProvisioned(
  userId: string,
  email: string,
): Promise<boolean> {
  if (getDatabaseBackendName() !== "postgres") return false;
  return withTrustedTransaction(async (client) => {
    const result = await client.query<{ exists: boolean }>(
      `select exists(
         select 1
         from auth.users u
         join public.teachers t on t.user_id = u.id
         where u.id = $1::uuid and lower(u.email) = lower($2)
       ) as exists`,
      [userId, email],
    );
    return result.rows[0]?.exists === true;
  });
}

export async function provisionBetterAuthApplicationIdentity(
  profile: BetterAuthSignupProfile,
): Promise<void> {
  if (getDatabaseBackendName() !== "postgres") {
    throw new Error("Better Auth signup requires DATABASE_BACKEND=postgres during auth migration.");
  }

  await withTrustedTransaction(async (client) => {
    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1::uuid, $2, $3::jsonb)`,
      [
        profile.userId,
        profile.email,
        JSON.stringify({ name: profile.name, school: profile.school, phone: profile.phone }),
      ],
    );
  });
}

/** Delete only the session created by the current credential operation. */
export async function removeBetterAuthSession(token: string): Promise<void> {
  await getBetterAuthPool().query("delete from better_auth.sessions where token = $1", [token]);
}

/**
 * Best-effort compensation when Better Auth has created credentials/session but
 * the temporary application-identity bridge fails. Deleting the Better Auth
 * user cascades its credential account and sessions.
 */
export async function removeBetterAuthUserAfterFailedSignup(userId: string): Promise<void> {
  await getBetterAuthPool().query("delete from better_auth.users where id = $1::uuid", [userId]);
}
