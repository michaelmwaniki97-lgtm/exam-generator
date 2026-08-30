import { randomBytes } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { assertSafeLocalDatabaseUrl } from "./migrate-local-postgres.mjs";

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(ROOT, ".env.local");

function runtimeUrl(adminUrl, password, database) {
  const url = new URL(adminUrl.href);
  url.username = "exam_app_runtime";
  url.password = password;
  url.pathname = `/${database}`;
  return url.href;
}

function testUrl(applicationUrl, database) {
  const url = new URL(applicationUrl);
  url.pathname = `/${database}_test`;
  return url.href;
}

export function updateEnvironmentSource(source, updates) {
  const remaining = new Map(Object.entries(updates));
  const lines = source.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match || !remaining.has(match[1])) return line;
    const value = remaining.get(match[1]);
    remaining.delete(match[1]);
    return `${match[1]}=${value}`;
  });
  while (lines.length && lines.at(-1) === "") lines.pop();
  for (const [key, value] of remaining) lines.push(`${key}=${value}`);
  return `${lines.join("\n")}\n`;
}

export async function configureLocalDatabase(environment = process.env) {
  const admin = assertSafeLocalDatabaseUrl(
    environment.LOCAL_DATABASE_ADMIN_URL || environment.DATABASE_URL,
    environment,
  );
  if (admin.database !== "exam_generator") {
    throw new Error("Local runtime configuration only targets exam_generator.");
  }

  const password = randomBytes(32).toString("base64url");
  const client = new Client({
    connectionString: admin.url.href,
    connectionTimeoutMillis: 5_000,
    application_name: "exam-generator-local-runtime-configuration",
  });
  await client.connect();
  try {
    const identity = (await client.query(
      "select current_database() as database, (select rolsuper from pg_roles where rolname = current_user) as is_superuser, exists(select 1 from pg_roles where rolname = 'exam_app_runtime') as runtime_exists",
    )).rows[0];
    if (identity.database !== admin.database || !identity.is_superuser) {
      throw new Error("Local runtime configuration requires the local database superuser.");
    }
    if (!identity.runtime_exists) {
      throw new Error("exam_app_runtime does not exist; run db:migrate:local first.");
    }
    const statement = (await client.query(
      "select format('alter role %I password %L', 'exam_app_runtime', $1::text) as sql",
      [password],
    )).rows[0].sql;
    await client.query(statement);
  } finally {
    await client.end();
  }

  const applicationUrl = runtimeUrl(admin.url, password, admin.database);
  const source = readFileSync(ENV_PATH, "utf8");
  const updated = updateEnvironmentSource(source, {
    LOCAL_DATABASE_ADMIN_URL: admin.url.href,
    POSTGRES_RUNTIME_PASSWORD: password,
    DATABASE_URL: applicationUrl,
    POSTGRES_TEST_DATABASE_URL: testUrl(applicationUrl, admin.database),
  });
  const temporary = `${ENV_PATH}.tmp`;
  writeFileSync(temporary, updated, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, ENV_PATH);

  return {
    database: admin.database,
    runtimeUser: "exam_app_runtime",
    environmentUpdated: true,
  };
}

async function main() {
  console.log(JSON.stringify(await configureLocalDatabase(), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Local database configuration failed.");
    process.exitCode = 1;
  });
}
