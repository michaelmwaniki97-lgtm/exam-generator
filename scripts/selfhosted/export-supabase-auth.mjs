import { createHash } from "node:crypto";
import { mkdir, open, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import pg from "pg";

const { Pool } = pg;
const BCRYPT = /^\$2[aby]\$\d{2}\$/;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const sourceUrl = requireEnv("SOURCE_DATABASE_URL");
  const output = resolve(process.env.AUTH_EXPORT_PATH || process.argv[2] || "/cutover/auth-users.jsonl");
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });

  const pool = new Pool({
    connectionString: sourceUrl,
    application_name: "exam-generator-auth-export",
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  });

  let rows;
  try {
    rows = (await pool.query(`
      select
        id::text,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmed_at,
        created_at,
        updated_at,
        coalesce(raw_user_meta_data, '{}'::jsonb) as raw_user_meta_data
      from auth.users
      order by id
    `)).rows;
  } finally {
    await pool.end();
  }

  if (rows.length === 0) throw new Error("Supabase Auth export contains no users.");
  for (const row of rows) {
    if (!row.id || !row.email || !row.created_at) throw new Error("Supabase Auth export contains a user missing required identity fields.");
    if (typeof row.encrypted_password !== "string" || !BCRYPT.test(row.encrypted_password)) {
      throw new Error("Supabase Auth export contains unsupported or missing password material; export aborted.");
    }
  }

  const tmp = `${output}.tmp-${process.pid}`;
  const handle = await open(tmp, "wx", 0o600);
  const hash = createHash("sha256");
  try {
    for (const row of rows) {
      const line = `${JSON.stringify(row)}\n`;
      hash.update(line);
      await handle.write(line);
    }
  } finally {
    await handle.close();
  }
  await rename(tmp, output);

  const sha256 = hash.digest("hex");
  const metadataPath = `${output}.meta.json`;
  await writeFile(metadataPath, `${JSON.stringify({ users: rows.length, sha256 }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ users: rows.length, output, sha256 }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Supabase Auth export failed.");
  process.exitCode = 1;
});
