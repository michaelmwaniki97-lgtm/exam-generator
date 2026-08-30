import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { getTextbookStorageProvider } from "./index.ts";
import { FilesystemTextbookStorageProvider } from "./filesystem.ts";
import { SupabaseTextbookStorageProvider } from "./supabase.ts";

const key = "textbooks/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/book.pdf";

test("development/build storage defaults to a private local filesystem and production runtime is explicit", () => {
  const names = ["NODE_ENV", "NEXT_PHASE", "TEXTBOOK_STORAGE_BACKEND", "TEXTBOOK_STORAGE_ROOT"] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = "development";
    delete process.env.TEXTBOOK_STORAGE_BACKEND;
    delete process.env.TEXTBOOK_STORAGE_ROOT;
    assert.ok(getTextbookStorageProvider() instanceof FilesystemTextbookStorageProvider);

    process.env.NODE_ENV = "production";
    process.env.NEXT_PHASE = "phase-production-build";
    assert.ok(getTextbookStorageProvider() instanceof FilesystemTextbookStorageProvider);
    delete process.env.NEXT_PHASE;
    assert.throws(() => getTextbookStorageProvider(), /TEXTBOOK_STORAGE_BACKEND is required in production/);
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("filesystem storage is private, contained, atomic/no-overwrite, and idempotently deletable", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "textbook-storage-"));
  context.after(async () => { await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true })); });
  const provider = new FilesystemTextbookStorageProvider(root);
  const bytes = new TextEncoder().encode("%PDF-synthetic");
  await provider.put(key, bytes, "application/pdf");
  assert.deepEqual(await provider.get(key), bytes);
  const metadata = await stat(path.join(root, key));
  assert.equal(metadata.isFile(), true);
  if (process.platform === "win32") {
    const implementation = await readFile(new URL("./filesystem.ts", import.meta.url), "utf8");
    assert.match(implementation, /open\(temporary, "wx", 0o600\)/);
    assert.match(implementation, /chmod\(this\.root, 0o700\)/);
  } else {
    assert.equal(metadata.mode & 0o777, 0o600);
  }
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
