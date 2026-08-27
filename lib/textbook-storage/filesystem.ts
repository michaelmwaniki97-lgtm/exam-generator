import "server-only";
import { chmod, link, mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MAX_PDF_BYTES } from "../textbooks/constants.ts";
import { assertTextbookStorageKey, type TextbookStorageProvider } from "./contracts.ts";

export class FilesystemTextbookStorageProvider implements TextbookStorageProvider {
  private readonly root: string;
  constructor(root: string) {
    if (!path.isAbsolute(root) || path.resolve(root) === path.parse(path.resolve(root)).root) throw new Error("TEXTBOOK_STORAGE_ROOT must be a private absolute directory.");
    this.root = path.resolve(root);
  }
  private resolve(key: string) {
    assertTextbookStorageKey(key);
    const target = path.resolve(this.root, key);
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error("Invalid textbook storage key.");
    return target;
  }
  async put(key: string, bytes: Uint8Array, contentType: "application/pdf") {
    if (contentType !== "application/pdf" || bytes.byteLength <= 0 || bytes.byteLength > MAX_PDF_BYTES) throw new Error("Invalid textbook file.");
    const target = this.resolve(key);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await chmod(this.root, 0o700);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close(); handle = undefined;
      await link(temporary, target);
      await rm(temporary);
    } catch (error) {
      await handle?.close().catch(() => undefined);
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }
  async get(key: string) {
    const target = this.resolve(key);
    const metadata = await stat(target);
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAX_PDF_BYTES) throw new Error("Invalid textbook file.");
    return new Uint8Array(await readFile(target));
  }
  async delete(key: string) { await rm(this.resolve(key), { force: true }); }
}
