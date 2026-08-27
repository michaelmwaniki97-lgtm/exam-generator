import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

function safePath(root, relative) {
  if (typeof relative !== "string" || relative.startsWith("/") || relative.includes("\\") || relative.split("/").some((p) => !p || p === "." || p === "..")) {
    throw new Error("Manifest contains an unsafe textbook path.");
  }
  const candidate = resolve(root, relative);
  if (!candidate.startsWith(`${resolve(root)}${sep}`)) throw new Error("Manifest path escapes export root.");
  return candidate;
}

async function main() {
  const root = resolve(process.argv[2] || process.env.TEXTBOOK_EXPORT_DIR || "/cutover/textbooks");
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  if (!Array.isArray(manifest.files)) throw new Error("Textbook manifest has no files array.");

  for (const file of manifest.files) {
    const path = safePath(root, file.storage_path);
    const info = await stat(path);
    if (!info.isFile() || info.size !== file.file_size) throw new Error(`Textbook size mismatch: ${file.storage_path}`);
    const sha256 = createHash("sha256").update(await readFile(path)).digest("hex");
    if (sha256 !== file.content_sha256) throw new Error(`Textbook SHA-256 mismatch: ${file.storage_path}`);
  }
  console.log(JSON.stringify({ verified: manifest.files.length, root }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Textbook verification failed.");
  process.exitCode = 1;
});
