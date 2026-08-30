import { createHash, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const VECTOR_MIGRATION = "20260823120000_add_private_textbook_rag.sql";

export function assertSafeLocalDatabaseUrl(value, environment = process.env) {
  if (!value) throw new Error("DATABASE_URL is required.");
  if (environment.NODE_ENV === "production") {
    throw new Error("The local migration runner refuses NODE_ENV=production.");
  }

  const url = new URL(value);
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL.");
  }
  if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(url.hostname)) {
    throw new Error("The local migration runner refuses non-loopback database hosts.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (database !== "exam_generator" && !database.endsWith("_test")) {
    throw new Error("The local migration runner permits only exam_generator or a *_test database.");
  }
  return { database, url };
}

export function stripSupportedPsqlMetaCommands(sql, filename) {
  const kept = [];
  for (const line of sql.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("\\")) {
      kept.push(line);
      continue;
    }
    if (/^\s*\\set\s+ON_ERROR_STOP\s+on\s*$/i.test(line)) continue;
    throw new Error(`Unsupported psql meta-command in ${filename}.`);
  }
  return kept.join("\n");
}

export function migrationFiles(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, path: join(directory, name) }));
}

function psqlPath(environment = process.env) {
  const candidates = [
    environment.PSQL_PATH,
    process.platform === "win32" ? "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" : undefined,
    "psql",
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === "psql" || existsSync(candidate));
}

function psqlEnvironment(url, extra = {}) {
  return {
    ...process.env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGCONNECT_TIMEOUT: "5",
    ...extra,
  };
}

function runCompatibilityLayer(url, runtimePassword) {
  const executable = psqlPath();
  if (!executable) throw new Error("psql was not found. Set PSQL_PATH to the reviewed PostgreSQL 17 psql executable.");
  const result = spawnSync(
    executable,
    ["-X", "-v", "ON_ERROR_STOP=1", "--file", join(ROOT, "infra/self-hosted/deploy/00-production-compatibility.sql")],
    {
      cwd: ROOT,
      env: psqlEnvironment(url, {
        POSTGRES_RUNTIME_PASSWORD: runtimePassword || randomBytes(32).toString("base64url"),
      }),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `psql exited ${result.status}`;
    throw new Error(`Compatibility schema failed: ${detail}`);
  }
}

async function ensureLedger(client) {
  await client.query(`
    create schema if not exists selfhosted_meta;
    create table if not exists selfhosted_meta.schema_migrations (
      name text primary key,
      sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
      applied_at timestamptz not null default now()
    );
    revoke all on schema selfhosted_meta from public, anon, authenticated, service_role;
    revoke all on all tables in schema selfhosted_meta from public, anon, authenticated, service_role;
  `);
}

async function applyMigration(client, migration) {
  const source = readFileSync(migration.path, "utf8");
  const sha256 = createHash("sha256").update(source).digest("hex");
  const recorded = await client.query(
    "select sha256 from selfhosted_meta.schema_migrations where name = $1",
    [migration.name],
  );
  if (recorded.rowCount) {
    if (recorded.rows[0].sha256 !== sha256) {
      throw new Error(`Migration checksum changed after application: ${migration.name}`);
    }
    return "already-applied";
  }

  const sql = stripSupportedPsqlMetaCommands(source, migration.name);
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query(
      "insert into selfhosted_meta.schema_migrations(name, sha256) values ($1, $2)",
      [migration.name, sha256],
    );
    await client.query("commit");
    return "applied";
  } catch (error) {
    try { await client.query("rollback"); } catch { /* preserve the migration error */ }
    throw error;
  }
}

export async function migrateLocalDatabase(environment = process.env) {
  const application = assertSafeLocalDatabaseUrl(environment.DATABASE_URL, environment);
  const migration = assertSafeLocalDatabaseUrl(
    environment.LOCAL_DATABASE_ADMIN_URL || environment.DATABASE_URL,
    environment,
  );
  if (application.database !== migration.database) {
    throw new Error("DATABASE_URL and LOCAL_DATABASE_ADMIN_URL must target the same local database.");
  }
  const { database } = application;
  runCompatibilityLayer(migration.url, environment.POSTGRES_RUNTIME_PASSWORD);

  const client = new Client({
    connectionString: migration.url.href,
    connectionTimeoutMillis: 5_000,
    query_timeout: 60_000,
    statement_timeout: 60_000,
    application_name: "exam-generator-local-migrations",
  });
  await client.connect();
  try {
    const identity = await client.query(`
      select current_database() as database, current_user as username,
             (select rolsuper from pg_roles where rolname = current_user) as is_superuser,
             current_setting('server_version') as postgres_version,
             exists(select 1 from pg_available_extensions where name = 'vector') as vector_available
    `);
    const row = identity.rows[0];
    if (row.database !== database) throw new Error("Connected database does not match DATABASE_URL.");
    if (!row.is_superuser) throw new Error("Fresh local bootstrap requires a PostgreSQL superuser.");

    await ensureLedger(client);
    const current = migrationFiles(join(ROOT, "supabase/migrations"));
    const auth = migrationFiles(join(ROOT, "infra/self-hosted/auth"));
    const applied = [];
    const alreadyApplied = [];
    const blocked = [];

    for (const migration of [...current, ...auth]) {
      if (migration.name === VECTOR_MIGRATION && !row.vector_available) {
        const recorded = await client.query(
          "select 1 from selfhosted_meta.schema_migrations where name = $1",
          [migration.name],
        );
        if (!recorded.rowCount) {
          blocked.push(migration.name);
          continue;
        }
      }
      const status = await applyMigration(client, migration);
      (status === "applied" ? applied : alreadyApplied).push(migration.name);
    }

    const ledger = await client.query("select count(*)::int as count from selfhosted_meta.schema_migrations");
    return {
      database,
      postgresVersion: row.postgres_version,
      vectorAvailable: row.vector_available,
      applied,
      alreadyApplied,
      blocked,
      ledgerCount: ledger.rows[0].count,
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const result = await migrateLocalDatabase();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocked.length) {
    console.error(`BLOCKED: ${result.blocked.join(", ")} requires the pgvector extension.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Local migration failed.");
    process.exitCode = 1;
  });
}
