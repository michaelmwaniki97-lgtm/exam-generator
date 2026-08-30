"use server";

import { UUID_PATTERN } from "@/lib/admin/validation";
import { getAuthenticatedRpcDatabase } from "@/lib/db";
import { isMissingOptionalTextbookSchema } from "@/lib/db/optional-textbook-schema";

export async function listReadyTextbooks(subjectId: string, gradeId: string) {
  if (!UUID_PATTERN.test(subjectId) || !UUID_PATTERN.test(gradeId)) throw new Error("Invalid textbook selection.");
  try {
    const database = await getAuthenticatedRpcDatabase();
    return await database.listReadyTextbooks({ subjectId, gradeId });
  } catch (error) {
    if (isMissingOptionalTextbookSchema(error)) return [];
    throw error;
  }
}
