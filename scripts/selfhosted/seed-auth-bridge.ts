import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Pool } from "pg";

type ExportRow = {
  id: string;
  email: string;
  raw_user_meta_data?: Record<string, unknown> | null;
  created_at: string;
};

async function readRows(path: string): Promise<ExportRow[]> {
  const rows: ExportRow[] = [];
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const reader = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  for await (const raw of reader) {
    const line = raw.trim();
    if (!line) continue;
    const row = JSON.parse(line) as ExportRow;
    const email = row.email?.trim().toLowerCase();
    if (!row.id || !email || !row.created_at) throw new Error("Auth bridge export row is missing required fields.");
    if (seenIds.has(row.id) || seenEmails.has(email)) throw new Error("Auth bridge export repeats an identity.");
    seenIds.add(row.id);
    seenEmails.add(email);
    rows.push({ ...row, email });
  }
  if (!rows.length) throw new Error("Auth bridge export contains no users.");
  return rows;
}

async function main() {
  const file = process.argv.find((value, index) => index >= 2 && !value.startsWith("--"));
  if (!file) throw new Error("Usage: seed-auth-bridge.ts <auth-users.jsonl> [--apply]");
  const apply = process.argv.includes("--apply");
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const rows = await readRows(file);
  const pool = new Pool({ connectionString: databaseUrl, application_name: "exam-generator-auth-bridge-seed", max: 1 });
  const client = await pool.connect();
  let inserted = 0;
  let existing = 0;
  try {
    await client.query("begin");
    for (const row of rows) {
      const found = (await client.query<{ id: string; email: string | null }>(
        `select id::text, email from auth.users where id = $1::uuid or lower(email) = lower($2)`,
        [row.id, row.email],
      )).rows;
      if (found.length) {
        if (found.length !== 1 || found[0].id !== row.id || found[0].email?.trim().toLowerCase() !== row.email) {
          throw new Error("Auth bridge identity conflict detected.");
        }
        existing += 1;
        continue;
      }
      inserted += 1;
      if (apply) {
        await client.query(
          `insert into auth.users (id, email, raw_user_meta_data, created_at)
           values ($1::uuid, $2, $3::jsonb, $4::timestamptz)`,
          [row.id, row.email, JSON.stringify(row.raw_user_meta_data ?? {}), row.created_at],
        );
      }
    }
    if (apply) await client.query("commit");
    else await client.query("rollback");
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", total: rows.length, inserted, existing }, null, 2));
  } catch (error) {
    try { await client.query("rollback"); } catch { /* preserve original error */ }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Auth bridge seed failed.");
  process.exitCode = 1;
});
