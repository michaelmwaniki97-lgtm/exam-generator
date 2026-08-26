"use server";

import { getCatalogRepository } from "@/lib/catalog";
import type { WizardGradeRow } from "@/lib/catalog/contracts";

export async function listWizardGrades(): Promise<
  { data: WizardGradeRow[]; error: null } | { data: null; error: string }
> {
  try {
    return { data: await (await getCatalogRepository()).listWizardGrades(), error: null };
  } catch {
    return { data: null, error: "Could not load supported Grades and Forms." };
  }
}
