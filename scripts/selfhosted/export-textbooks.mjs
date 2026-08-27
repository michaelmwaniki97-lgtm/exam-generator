import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Pool } = pg;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function safeRelativePath(value) {
  if (typeof value !== "string" || !value || value.startsWith("/") || value.includes("\\")) {
    throw new Error("Unsafe textbook storage path encountered.");
  }
  const parts = value.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Unsafe textbook storage path encountered.");
  }
  return parts.join("/");
}

function pathInside(root, relative) {
  const candidate = resolve(root, relative);
  const normalizedRoot = `${resolve(root)}${sep}`;
  if (!candidate.startsWith(normalizedRoot)) throw new Error("Textbook path escaped the export root.");
  return candidate;
}

async function main() {
  const sourceDatabaseUrl = requireEnv("SOURCE_DATABASE_URL");
  const supabaseUrl = requireEnv("SOURCE_SUPABASE_URL");
  const serviceKey = requireEnv("SOURCE_SUPABASE_SERVICE_ROLE_KEY");
  const bucket = process.env.SOURCE_TEXTBOOK_BUCKET?.trim() || "textbooks";
  const outputRoot = resolve(process.env.TEXTBOOK_EXPORT_DIR || process.argv[2] || "/cutover/textbooks");
  await mkdir(outputRoot, { recursive: true, mode: 0o700 });

  const pool = new Pool({ connectionString: sourceDatabaseUrl, application_name: "exam-generator-textbook-export", max: 1 });
  let documents;
  let objectPaths;
  try {
    documents = (await pool.query(`
      select id::text, storage_path, file_size::bigint::text, content_sha256, mime_type
      from public.textbook_documents
      order by storage_path
    `)).rows;
    objectPaths = (await pool.query(
      `select name from storage.objects where bucket_id = $1 order by name`,
      [bucket],
    )).rows.map((row) => row.name);
  } finally {
    await pool.end();
  }

  const documentPaths = documents.map((doc) => safeRelativePath(doc.storage_path));
  const extras = objectPaths.filter((name) => !documentPaths.includes(name));
  const missing = documentPaths.filter((name) => !objectPaths.includes(name));
  if (extras.length || missing.length) {
    throw new Error(`Storage/database inventory mismatch (missing=${missing.length}, extra=${extras.length}).`);
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const manifest = [];
  for (const doc of documents) {
    const relative = safeRelativePath(doc.storage_path);
    const { data, error } = await client.storage.from(bucket).download(relative);
    if (error || !data) throw new Error(`Failed to download textbook object ${relative}.`);
    const bytes = Buffer.from(await data.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const expectedSize = Number(doc.file_size);
    if (!Number.isSafeInteger(expectedSize) || expectedSize < 0 || bytes.length !== expectedSize) {
      throw new Error(`Textbook size mismatch for ${relative}.`);
    }
    if (sha256 !== String(doc.content_sha256).toLowerCase()) {
      throw new Error(`Textbook SHA-256 mismatch for ${relative}.`);
    }

    const output = pathInside(outputRoot, relative);
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await writeFile(output, bytes, { mode: 0o600 });
    manifest.push({
      id: doc.id,
      storage_path: relative,
      file_size: bytes.length,
      content_sha256: sha256,
      mime_type: doc.mime_type,
    });
  }

  const manifestText = `${JSON.stringify({ bucket, files: manifest }, null, 2)}\n`;
  await writeFile(join(outputRoot, "manifest.json"), manifestText, { mode: 0o600 });
  console.log(JSON.stringify({ bucket, files: manifest.length, outputRoot }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Textbook export failed.");
  process.exitCode = 1;
});
