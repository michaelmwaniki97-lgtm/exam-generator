import "server-only";

import type { PoolClient } from "pg";
import { getDatabaseBackendName } from "../db/config.ts";
import { isAuthCutoverAccepted } from "../auth-backend/cutover-state.ts";
import { withTrustedTransaction } from "../db/postgres-client.ts";
import { getBetterAuthPool } from "./pool.ts";

export type BetterAuthSignupProfile = Readonly<{
  userId: string;
  email: string;
  name: string;
  school: string;
  phone: string;
}>;

type ApplicationIdentityAnchor = "auth.users" | "better_auth.users";

async function applicationIdentityAnchor(client: PoolClient): Promise<ApplicationIdentityAnchor> {
  const textbookDocumentsExists = (await client.query<{ exists: boolean }>(
    "select to_regclass('public.textbook_documents') is not null as exists",
  )).rows[0]?.exists === true;
  const rows = (await client.query<{ constraint_name: string; target: string }>(
    `select c.conname as constraint_name,
            target_ns.nspname || '.' || target.relname as target
       from pg_constraint c
       join pg_class source on source.oid = c.conrelid
       join pg_namespace source_ns on source_ns.oid = source.relnamespace
       join pg_class target on target.oid = c.confrelid
       join pg_namespace target_ns on target_ns.oid = target.relnamespace
      where c.contype = 'f'
        and source_ns.nspname = 'public'
        and (
          (source.relname = 'teachers' and c.conname = 'teachers_user_id_fkey')
          or (source.relname = 'admins' and c.conname = 'admins_user_id_fkey')
          or (source.relname = 'textbook_documents' and c.conname = 'textbook_documents_uploaded_by_fkey')
        )
      order by c.conname`,
  )).rows;

  const requiredConstraints = new Set([
    "teachers_user_id_fkey",
    "admins_user_id_fkey",
    ...(textbookDocumentsExists ? ["textbook_documents_uploaded_by_fkey"] : []),
  ]);
  if (
    rows.length !== requiredConstraints.size
    || rows.some((row) => !requiredConstraints.has(row.constraint_name))
    || (isAuthCutoverAccepted() && !textbookDocumentsExists)
  ) {
    throw new Error("Application identity schema is incomplete; refusing Auth provisioning.");
  }
  const targets = new Set(rows.map((row) => row.target));
  if (targets.size !== 1) {
    throw new Error("Application identity schema is mid-cutover; refusing Auth provisioning.");
  }
  const target = rows[0]?.target;
  if (target !== "auth.users" && target !== "better_auth.users") {
    throw new Error("Application identity schema references an unsupported identity table.");
  }
  return target;
}

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
 * Auth-migration-aware application identity provisioning.
 *
 * Before the manual FK cutover, the three application identity FKs still point
 * at auth.users, so Better Auth signup uses the temporary UUID-preserving mirror
 * and the historical handle_new_user trigger creates the teacher row.
 *
 * After the manual FK cutover, the FKs point at better_auth.users and the
 * temporary auth.users bridge is retired. The trusted server transaction then
 * creates the teacher profile directly with the already-validated Better Auth
 * UUID and signup metadata. A mixed/partial FK state fails closed.
 */
export async function betterAuthApplicationIdentityWasProvisioned(
  userId: string,
  email: string,
): Promise<boolean> {
  if (getDatabaseBackendName() !== "postgres") return false;
  return withTrustedTransaction(async (client) => {
    const anchor = await applicationIdentityAnchor(client);
    if (isAuthCutoverAccepted() && anchor !== "better_auth.users") {
      throw new Error("Accepted Better Auth cutover requires application FKs to better_auth.users.");
    }
    if (anchor === "auth.users") {
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
    }

    const result = await client.query<{ exists: boolean }>(
      `select exists(
         select 1
         from better_auth.users u
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
    const anchor = await applicationIdentityAnchor(client);
    if (isAuthCutoverAccepted() && anchor !== "better_auth.users") {
      throw new Error("Accepted Better Auth cutover requires application FKs to better_auth.users.");
    }
    if (anchor === "auth.users") {
      await client.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1::uuid, $2, $3::jsonb)`,
        [
          profile.userId,
          profile.email,
          JSON.stringify({ name: profile.name, school: profile.school, phone: profile.phone }),
        ],
      );
      return;
    }

    await client.query(
      `insert into public.teachers (user_id, name, school, phone)
       values ($1::uuid, $2, $3, $4)`,
      [profile.userId, profile.name, profile.school || null, profile.phone || null],
    );
  });
}

/** Delete only the session created by the current credential operation. */
export async function removeBetterAuthSession(token: string): Promise<void> {
  await getBetterAuthPool().query("delete from better_auth.sessions where token = $1", [token]);
}

/**
 * Best-effort compensation when Better Auth has created credentials/session but
 * application identity provisioning fails. Before cutover this deletes only the
 * Better Auth credential/session rows; after cutover the teacher FK cascades as
 * part of the same canonical Better Auth user deletion.
 */
export async function removeBetterAuthUserAfterFailedSignup(userId: string): Promise<void> {
  await getBetterAuthPool().query("delete from better_auth.users where id = $1::uuid", [userId]);
}
