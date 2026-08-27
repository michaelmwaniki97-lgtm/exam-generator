import "server-only";
import { createAdminClient } from "../supabase/admin.ts";
import type { TextbookStorageProvider } from "./contracts.ts";
import { FilesystemTextbookStorageProvider } from "./filesystem.ts";
import { SupabaseTextbookStorageProvider } from "./supabase.ts";

export type * from "./contracts.ts";

export function getTextbookStorageProvider(): TextbookStorageProvider {
  const backend = process.env.TEXTBOOK_STORAGE_BACKEND?.trim() || "supabase";
  if (backend === "supabase") return new SupabaseTextbookStorageProvider(createAdminClient());
  if (backend === "filesystem") {
    const root = process.env.TEXTBOOK_STORAGE_ROOT?.trim();
    if (!root) throw new Error("TEXTBOOK_STORAGE_ROOT is required when TEXTBOOK_STORAGE_BACKEND=filesystem.");
    return new FilesystemTextbookStorageProvider(root);
  }
  throw new Error(`Unsupported TEXTBOOK_STORAGE_BACKEND: ${backend}`);
}
