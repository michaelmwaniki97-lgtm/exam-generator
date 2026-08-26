"use server";

import { UUID_PATTERN } from "@/lib/admin/validation";
import { getCurriculumReadRepository } from "@/lib/curriculum-read";

export async function listActiveCurriculumGradeIds() {
  try {
    return { data: await (await getCurriculumReadRepository()).listActiveGradeIds(), error: null };
  } catch {
    return { data: null, error: "Could not load active curriculum contexts." };
  }
}

export async function listCurriculumSubjects(gradeId: string) {
  if (!UUID_PATTERN.test(gradeId)) return { data: null, error: "Invalid grade." };
  try {
    return { data: await (await getCurriculumReadRepository()).listSubjectContextsForGrade(gradeId), error: null };
  } catch {
    return { data: null, error: "Could not load subjects with active curriculum." };
  }
}

export async function listActiveCurriculum(gradeId: string, subjectId: string) {
  if (!UUID_PATTERN.test(gradeId) || !UUID_PATTERN.test(subjectId)) {
    return { data: null, error: "Invalid curriculum context." };
  }
  try {
    return { data: await (await getCurriculumReadRepository()).listActiveHierarchy(gradeId, subjectId), error: null };
  } catch {
    return { data: null, error: "Could not load the active curriculum for this class and subject." };
  }
}
