import "server-only";

import { getCurrentIdentityContext } from "../identity-read/index.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { createClient } from "../supabase/server.ts";
import type { TeacherProfileWriteRepository } from "./contracts.ts";
import { PostgresTeacherProfileWriteRepository } from "./postgres.ts";
import { SupabaseTeacherProfileWriteRepository } from "./supabase.ts";

export type * from "./contracts.ts";

export type TeacherProfileWriteContext =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "authorized"; repository: TeacherProfileWriteRepository };

export async function getTeacherProfileWriteContext(): Promise<TeacherProfileWriteContext> {
  const identity = await getCurrentIdentityContext();
  if (!identity) return { status: "unauthenticated" };
  if (await identity.repository.resolveRole() !== "teacher") return { status: "forbidden" };

  const repository = getDatabaseBackendName() === "postgres"
    ? new PostgresTeacherProfileWriteRepository(identity.user.id)
    : new SupabaseTeacherProfileWriteRepository(await createClient(), identity.user.id);
  return { status: "authorized", repository };
}
