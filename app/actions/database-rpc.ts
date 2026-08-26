"use server";

import { UUID_PATTERN } from "@/lib/admin/validation";
import { getAuthenticatedRpcDatabase } from "@/lib/db";

export async function listReadyTextbooks(subjectId: string, gradeId: string) {
  if (!UUID_PATTERN.test(subjectId) || !UUID_PATTERN.test(gradeId)) throw new Error("Invalid textbook selection.");
  return getAuthenticatedRpcDatabase().then((database) => database.listReadyTextbooks({ subjectId, gradeId }));
}
