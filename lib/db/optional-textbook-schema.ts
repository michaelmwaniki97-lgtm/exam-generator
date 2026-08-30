import { DatabaseRpcError } from "./contracts.ts";

export function isMissingOptionalTextbookSchema(error: unknown): boolean {
  if (!(error instanceof DatabaseRpcError)) return false;
  if (error.code === "42883") return /list_ready_textbooks/i.test(error.message);
  if (error.code === "42P01") return /textbook_(?:documents|chunks)/i.test(error.message);
  return false;
}
