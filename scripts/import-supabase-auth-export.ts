import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { Pool } from "pg";
import {
  authCutoverReadinessIsClean,
  getAuthCutoverReadiness,
  importSupabaseAuthExport,
  type SupabaseAuthExportRecord,
} from "../lib/better-auth/import.ts";

function usage(): never {
  throw new Error(
    "Usage: node --conditions=react-server --experimental-strip-types scripts/import-supabase-auth-export.ts <export.jsonl> [--apply]",
  );
}

async function readExport(path: string): Promise<SupabaseAuthExportRecord[]> {
  const rows: SupabaseAuthExportRecord[] = [];
  const reader = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const rawLine of reader) {
    lineNumber += 1;
    const line = rawLine.trim();
    if (!line) continue;
    try {
      rows.push(JSON.parse(line) as SupabaseAuthExportRecord);
    } catch {
      throw new Error(`Auth export contains invalid JSON on line ${lineNumber}.`);
    }
  }
  if (rows.length === 0) throw new Error("Auth export contains no users.");
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  if (!fileArg) usage();
  const unknown = args.filter((arg) => arg.startsWith("--") && arg !== "--apply");
  if (unknown.length) usage();

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the target self-hosted PostgreSQL database.");

  const apply = args.includes("--apply");
  const records = await readExport(resolve(fileArg));
  const pool = new Pool({
    connectionString: databaseUrl,
    options: "-c search_path=better_auth,public",
    application_name: "exam-generator-auth-import",
    max: 2,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  });

  try {
    const summary = await importSupabaseAuthExport(pool, records, { dryRun: !apply });
    const readiness = await getAuthCutoverReadiness(pool);

    // Intentionally output counts only. Never print imported records, emails,
    // password hashes, metadata, or connection strings.
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", summary, readiness }, null, 2));

    if (apply && !authCutoverReadinessIsClean(readiness)) {
      throw new Error("Auth import completed but cutover readiness still has orphan/mismatch counts.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Auth import failed.";
  console.error(message);
  process.exitCode = 1;
});
