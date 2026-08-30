import "server-only";
import path from "node:path";
import { createAdminClient } from "../supabase/admin.ts";
import type { TextbookStorageProvider } from "./contracts.ts";
import { FilesystemTextbookStorageProvider } from "./filesystem.ts";
import { SupabaseTextbookStorageProvider } from "./supabase.ts";

export type * from "./contracts.ts";

export function getTextbookStorageProvider(): TextbookStorageProvider {
  const configured = process.env.TEXTBOOK_STORAGE_BACKEND?.trim().toLowerCase();
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const backend = configured || (
    process.env.NODE_ENV === "development" || isBuild
      ? "filesystem"
      : process.env.NODE_ENV === "production"
        ? ""
        : "supabase"
  );
  if (!backend) {
    throw new Error(
      "TEXTBOOK_STORAGE_BACKEND is required in production; use filesystem for the accepted self-hosted runtime or supabase only for an approved compatibility/rollback deployment.",
    );
  }
  if (backend === "supabase") return new SupabaseTextbookStorageProvider(createAdminClient());
  if (backend === "filesystem") {
    const root = process.env.TEXTBOOK_STORAGE_ROOT?.trim() || (
      process.env.NODE_ENV === "development" || isBuild
        ? path.resolve(process.cwd(), ".next", isBuild ? "build-textbooks" : "development-textbooks")
        : ""
    );
    if (!root) throw new Error("TEXTBOOK_STORAGE_ROOT is required when TEXTBOOK_STORAGE_BACKEND=filesystem.");
    return new FilesystemTextbookStorageProvider(root);
  }
  throw new Error(`Unsupported TEXTBOOK_STORAGE_BACKEND: ${backend}`);
}
