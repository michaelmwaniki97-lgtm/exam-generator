import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_PDF_BYTES, TEXTBOOK_BUCKET } from "../textbooks/constants.ts";
import { assertTextbookStorageKey, type TextbookStorageProvider } from "./contracts.ts";

export class SupabaseTextbookStorageProvider implements TextbookStorageProvider {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }
  async put(key: string, bytes: Uint8Array, contentType: "application/pdf") {
    assertTextbookStorageKey(key);
    if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("Textbook file exceeds the storage limit.");
    const { error } = await this.client.storage.from(TEXTBOOK_BUCKET).upload(key, bytes, { contentType, upsert: false });
    if (error) throw new Error("Textbook storage upload failed.");
  }
  async get(key: string) {
    assertTextbookStorageKey(key);
    const { data, error } = await this.client.storage.from(TEXTBOOK_BUCKET).download(key);
    if (error || !data) throw new Error("Textbook storage read failed.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.byteLength > MAX_PDF_BYTES) throw new Error("Textbook file exceeds the storage limit.");
    return bytes;
  }
  async delete(key: string) {
    assertTextbookStorageKey(key);
    const { error } = await this.client.storage.from(TEXTBOOK_BUCKET).remove([key]);
    if (error) throw new Error("Textbook storage delete failed.");
  }
}
