import "server-only";

import { Pool } from "pg";

const GLOBAL_POOL = Symbol.for("exam-generator.better-auth-pool");

type BetterAuthGlobals = typeof globalThis & {
  [GLOBAL_POOL]?: Pool;
};

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required when AUTH_BACKEND=better-auth.");
  return value;
}

export function getBetterAuthPool(): Pool {
  const globals = globalThis as BetterAuthGlobals;
  if (!globals[GLOBAL_POOL]) {
    globals[GLOBAL_POOL] = new Pool({
      connectionString: databaseUrl(),
      options: "-c search_path=better_auth,public",
      max: 5,
      min: 0,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      maxLifetimeSeconds: 1_800,
      query_timeout: 15_000,
      statement_timeout: 15_000,
      application_name: "exam-generator-better-auth",
      allowExitOnIdle: process.env.NODE_ENV !== "production",
    });
  }
  return globals[GLOBAL_POOL];
}

export async function closeBetterAuthPool(): Promise<void> {
  const globals = globalThis as BetterAuthGlobals;
  const pool = globals[GLOBAL_POOL];
  if (!pool) return;
  delete globals[GLOBAL_POOL];
  await pool.end();
}
