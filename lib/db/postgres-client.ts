import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { DatabaseRpcError } from "./contracts.ts";

const GLOBAL_POOL = Symbol.for("exam-generator.postgres-pool");
const GLOBAL_SHUTDOWN = Symbol.for("exam-generator.postgres-pool-shutdown");

type DatabaseGlobals = typeof globalThis & {
  [GLOBAL_POOL]?: Pool;
  [GLOBAL_SHUTDOWN]?: boolean;
};

function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required when DATABASE_BACKEND=postgres.");
  return value;
}

function createPool(): Pool {
  return new Pool({
    connectionString: databaseUrl(),
    max: 10,
    min: 0,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    maxLifetimeSeconds: 1_800,
    query_timeout: 15_000,
    statement_timeout: 15_000,
    application_name: "exam-generator",
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  });
}

export function getPostgresPool(): Pool {
  const globals = globalThis as DatabaseGlobals;
  if (!globals[GLOBAL_POOL]) globals[GLOBAL_POOL] = createPool();
  if (!globals[GLOBAL_SHUTDOWN] && process.env.NODE_ENV === "production") {
    globals[GLOBAL_SHUTDOWN] = true;
    const close = () => void closePostgresPool();
    process.once("SIGTERM", close);
    process.once("SIGINT", close);
  }
  return globals[GLOBAL_POOL];
}

export async function closePostgresPool(): Promise<void> {
  const globals = globalThis as DatabaseGlobals;
  const pool = globals[GLOBAL_POOL];
  if (!pool) return;
  delete globals[GLOBAL_POOL];
  await pool.end();
}

async function transaction<T>(configure: (client: PoolClient) => Promise<void>, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPostgresPool().connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout = '15s'");
    await client.query("set local idle_in_transaction_session_timeout = '10s'");
    await configure(client);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch { /* preserve the original error */ }
    if (error instanceof Error) {
      const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
      throw new DatabaseRpcError(error.message, code);
    }
    throw new DatabaseRpcError("Database operation failed.");
  } finally {
    client.release();
  }
}

export function withAuthenticatedTransaction<T>(userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  return transaction(async (client) => {
    await client.query("set local role authenticated");
    await client.query("select set_config($1, $2, true), set_config($3, $4, true)", [
      "request.jwt.claim.sub", userId,
      "request.jwt.claim.role", "authenticated",
    ]);
  }, work);
}

export function withTrustedTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  return transaction(async (client) => {
    await client.query("set local role service_role");
    await client.query("select set_config($1, $2, true)", ["request.jwt.claim.role", "service_role"]);
  }, work);
}

export async function queryRows<Row extends QueryResultRow>(client: PoolClient, text: string, values: unknown[]): Promise<Row[]> {
  return (await client.query<Row>({ text, values })).rows;
}
