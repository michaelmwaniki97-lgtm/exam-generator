import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { FilesystemTextbookStorageProvider } from "./filesystem.ts";
import { SupabaseTextbookStorageProvider } from "./supabase.ts";

const key = "textbooks/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/book.pdf";

test("filesystem storage is private, contained, atomic/no-overwrite, and idempotently deletable", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "textbook-storage-"));
  context.after(async () => { await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true })); });
  const provider = new FilesystemTextbookStorageProvider(root);
  const bytes = new TextEncoder().encode("%PDF-synthetic");
  await provider.put(key, bytes, "application/pdf");
  assert.deepEqual(await provider.get(key), bytes);
  assert.equal((await stat(path.join(root, key))).mode & 0o777, 0o600);
  await assert.rejects(() => provider.put(key, bytes, "application/pdf"));
  await assert.rejects(() => provider.get("textbooks/../../secret.pdf"));
  assert.deepEqual(new Uint8Array(await readFile(path.join(root, key))), bytes);
  await provider.delete(key); await provider.delete(key);
});

test("Supabase fallback preserves private bucket operations and rejects errors", async () => {
  const calls: unknown[][] = [];
  const bucket = {
    upload: async (...args: unknown[]) => { calls.push(["upload", ...args]); return { error: null }; },
    download: async (...args: unknown[]) => { calls.push(["download", ...args]); return { data: new Blob(["%PDF-x"]), error: null }; },
    remove: async (...args: unknown[]) => { calls.push(["remove", ...args]); return { error: null }; },
  };
  const client = { storage: { from: (name: string) => { assert.equal(name, "textbooks"); return bucket; } } };
  const provider = new SupabaseTextbookStorageProvider(client as never);
  await provider.put(key, new TextEncoder().encode("%PDF-x"), "application/pdf");
  assert.equal(new TextDecoder().decode(await provider.get(key)), "%PDF-x");
  await provider.delete(key);
  assert.deepEqual(calls.map((call) => call[0]), ["upload", "download", "remove"]);
});
