"use server";

import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/auth/access";
import { getCurrentUser, getUserRole } from "@/lib/auth/session";
import {
  cleanId,
  cleanRequiredMultiline,
  cleanRequiredText,
  hasDuplicate,
  type NamedRow,
} from "@/lib/admin/validation";
import { createClient } from "@/lib/supabase/server";
import { getCatalogRepository } from "@/lib/catalog";
import { getCurriculumReadRepository } from "@/lib/curriculum-read";
import { getAdminReportingRepository } from "@/lib/admin-reporting";
import { getCatalogWriteRepository } from "@/lib/catalog-write";

export type AdminActionState =
  | { status: "success"; message: string }
  | { status: "error"; message: string }
  | undefined;

type AdminClient = Awaited<ReturnType<typeof createClient>>;
type Operation = (supabase: AdminClient) => Promise<AdminActionState>;
type NameRow = { id: string; name: string };
type OutcomeRow = { id: string; description: string };

function error(message: string): AdminActionState {
  return { status: "error", message };
}

function success(message: string, path: string): AdminActionState {
  revalidatePath(path);
  return { status: "success", message };
}

function namedRows(rows: NameRow[] | null): NamedRow[] {
  return (rows ?? []).map((row) => ({ id: row.id, value: row.name }));
}

function outcomeRows(rows: OutcomeRow[] | null): NamedRow[] {
  return (rows ?? []).map((row) => ({ id: row.id, value: row.description }));
}

async function withAdmin(operation: Operation): Promise<AdminActionState> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || !isAdminRole(role)) {
    return error("Administrator access is required for this action.");
  }

  try {
    return await operation(await createClient());
  } catch {
    return error("The request could not be completed. Please try again.");
  }
}

function dependencyMessage(
  label: string,
  dependencies: Array<{ count: number | null; label: string }>
): string | null {
  const used = dependencies.filter((item) => (item.count ?? 0) > 0);
  if (used.length === 0) return null;
  const summary = used
    .map((item) => String(item.count) + " " + item.label)
    .join(", ");
  return label + " cannot be deleted because it is used by " + summary + ".";
}

export async function createSubject(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const name = cleanRequiredText(formData.get("name"), "Subject name", 120);
  if ("error" in name) return error(name.error);

  return withAdmin(async () => {
    const existing = await (await getCatalogRepository()).listSubjectNames().catch(() => null);
    if (!existing) return error("Could not check existing subjects.");
    if (hasDuplicate(namedRows(existing), name.value)) {
      return error("A subject with this name already exists.");
    }

    try { await (await getCatalogWriteRepository()).createSubject(name.value); }
    catch { return error("Could not add the subject."); }
    return success("Subject added.", "/admin/subjects");
  });
}

export async function updateSubject(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "subject");
  const name = cleanRequiredText(formData.get("name"), "Subject name", 120);
  if ("error" in id) return error(id.error);
  if ("error" in name) return error(name.error);

  return withAdmin(async () => {
    const existing = await (await getCatalogRepository()).listSubjectNames().catch(() => null);
    if (!existing) return error("Could not check existing subjects.");
    if (!(existing ?? []).some((row) => row.id === id.value)) return error("Subject not found.");
    if (hasDuplicate(namedRows(existing), name.value, id.value)) {
      return error("A subject with this name already exists.");
    }

    try { await (await getCatalogWriteRepository()).updateSubject(id.value, name.value); }
    catch { return error("Could not update the subject."); }
    return success("Subject updated.", "/admin/subjects");
  });
}

export async function deleteSubject(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "subject");
  if ("error" in id) return error(id.error);

  return withAdmin(async () => {
    const dependencies = await getAdminReportingRepository()
      .then((repository) => repository.getSubjectDependencies(id.value))
      .catch(() => null);
    if (!dependencies) {
      return error("Could not verify whether this subject is in use.");
    }

    const blocked = dependencyMessage("This subject", [
      { count: dependencies.curriculum, label: "curriculum strands/topics" },
      { count: dependencies.textbooks, label: "textbooks" },
      { count: dependencies.exams, label: "exams" },
    ]);
    if (blocked) return error(blocked);

    let deleted = false;
    try { deleted = await (await getCatalogWriteRepository()).deleteSubject(id.value); }
    catch { return error("Could not delete the subject."); }
    if (!deleted) return error("Subject not found.");
    return success("Subject deleted.", "/admin/subjects");
  });
}

export async function createGrade(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const name = cleanRequiredText(formData.get("name"), "Grade or class name", 80);
  const level = cleanRequiredText(formData.get("level"), "Education level", 80);
  if ("error" in name) return error(name.error);
  if ("error" in level) return error(level.error);

  return withAdmin(async () => {
    const existing = await (await getCatalogRepository()).listGradeNames().catch(() => null);
    if (!existing) return error("Could not check existing grades and classes.");
    if (hasDuplicate(namedRows(existing), name.value)) {
      return error("A grade or class with this name already exists.");
    }

    try { await (await getCatalogWriteRepository()).createGrade(name.value, level.value); }
    catch { return error("Could not add the grade or class."); }
    return success("Grade or class added.", "/admin/grades");
  });
}

export async function updateGrade(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "grade or class");
  const name = cleanRequiredText(formData.get("name"), "Grade or class name", 80);
  const level = cleanRequiredText(formData.get("level"), "Education level", 80);
  if ("error" in id) return error(id.error);
  if ("error" in name) return error(name.error);
  if ("error" in level) return error(level.error);

  return withAdmin(async () => {
    const existing = await (await getCatalogRepository()).listGradeNames().catch(() => null);
    if (!existing) return error("Could not check existing grades and classes.");
    if (!(existing ?? []).some((row) => row.id === id.value)) {
      return error("Grade or class not found.");
    }
    if (hasDuplicate(namedRows(existing), name.value, id.value)) {
      return error("A grade or class with this name already exists.");
    }

    try { await (await getCatalogWriteRepository()).updateGrade(id.value, name.value, level.value); }
    catch { return error("Could not update the grade or class."); }
    return success("Grade or class updated.", "/admin/grades");
  });
}

export async function deleteGrade(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "grade or class");
  if ("error" in id) return error(id.error);

  return withAdmin(async () => {
    const dependencies = await getAdminReportingRepository()
      .then((repository) => repository.getGradeDependencies(id.value))
      .catch(() => null);
    if (!dependencies) {
      return error("Could not verify whether this grade or class is in use.");
    }

    const blocked = dependencyMessage("This grade or class", [
      { count: dependencies.curriculum, label: "curriculum strands/topics" },
      { count: dependencies.textbooks, label: "textbooks" },
      { count: dependencies.exams, label: "exams" },
    ]);
    if (blocked) return error(blocked);

    let deleted = false;
    try { deleted = await (await getCatalogWriteRepository()).deleteGrade(id.value); }
    catch { return error("Could not delete the grade or class."); }
    if (!deleted) return error("Grade or class not found.");
    return success("Grade or class deleted.", "/admin/grades");
  });
}

export async function createStrand(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const gradeId = cleanId(formData.get("gradeId"), "grade or class");
  const subjectId = cleanId(formData.get("subjectId"), "subject");
  const name = cleanRequiredText(formData.get("name"), "Strand or topic name", 180);
  if ("error" in gradeId) return error(gradeId.error);
  if ("error" in subjectId) return error(subjectId.error);
  if ("error" in name) return error(name.error);

  return withAdmin(async (supabase) => {
    const existing = await (await getCurriculumReadRepository())
      .listStrandNames(gradeId.value, subjectId.value).catch(() => null);
    if (!existing) return error("Could not check existing strands or topics.");
    if (hasDuplicate(namedRows(existing), name.value)) {
      return error("A strand or topic with this exact name already exists here.");
    }

    const { error: insertError } = await supabase.from("strands").insert({
      grade_id: gradeId.value,
      subject_id: subjectId.value,
      name: name.value,
    });
    if (insertError) return error("Could not add the strand or topic.");
    return success("Strand or topic added as unverified.", "/admin/curriculum");
  });
}

export async function updateStrand(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "strand or topic");
  const name = cleanRequiredText(formData.get("name"), "Strand or topic name", 180);
  if ("error" in id) return error(id.error);
  if ("error" in name) return error(name.error);

  return withAdmin(async (supabase) => {
    const curriculum = await getCurriculumReadRepository();
    const current = await curriculum.getStrandParent(id.value).catch(() => null);
    if (!current) return error("Strand or topic not found.");
    const existing = await curriculum.listStrandNames(current.grade_id, current.subject_id).catch(() => null);
    if (!existing) return error("Could not check existing strands or topics.");
    if (hasDuplicate(namedRows(existing), name.value, id.value)) {
      return error("A strand or topic with this exact name already exists here.");
    }

    let { error: updateError } = await supabase
      .from("strands")
      .update({
        name: name.value,
        source_code: null,
        verification_status: "unverified",
        outcome_status: "unverified",
        source_ref: null,
        source_metadata: {},
      })
      .eq("id", id.value);
    if (updateError?.code === "PGRST204") {
      const legacyResult = await supabase
        .from("strands")
        .update({ name: name.value })
        .eq("id", id.value);
      updateError = legacyResult.error;
    }
    if (updateError) return error("Could not update the strand or topic.");
    return success("Strand or topic updated; verification is still required.", "/admin/curriculum");
  });
}

export async function deleteStrand(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "strand or topic");
  if ("error" in id) return error(id.error);

  return withAdmin(async (supabase) => {
    const count = await (await getCurriculumReadRepository()).countSubStrands(id.value).catch(() => null);
    if (count === null) return error("Could not verify whether this strand or topic is in use.");
    if ((count ?? 0) > 0) {
      return error(
        "This strand or topic cannot be deleted because it has " +
          String(count) +
          " sub-strand/sub-topic records. Remove those safely first."
      );
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("strands")
      .delete()
      .eq("id", id.value)
      .select("id");
    if (deleteError) return error("Could not delete the strand or topic.");
    if (!deleted?.length) return error("Strand or topic not found.");
    return success("Strand or topic deleted.", "/admin/curriculum");
  });
}

export async function createSubStrand(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const strandId = cleanId(formData.get("strandId"), "strand or topic");
  const name = cleanRequiredText(formData.get("name"), "Sub-strand or sub-topic name", 180);
  if ("error" in strandId) return error(strandId.error);
  if ("error" in name) return error(name.error);

  return withAdmin(async (supabase) => {
    const existing = await (await getCurriculumReadRepository()).listSubStrandNames(strandId.value).catch(() => null);
    if (!existing) return error("Could not check existing sub-strands or sub-topics.");
    if (hasDuplicate(namedRows(existing), name.value)) {
      return error("A sub-strand or sub-topic with this exact name already exists here.");
    }

    const { error: insertError } = await supabase
      .from("sub_strands")
      .insert({ strand_id: strandId.value, name: name.value });
    if (insertError) return error("Could not add the sub-strand or sub-topic.");
    return success("Sub-strand or sub-topic added as unverified.", "/admin/curriculum");
  });
}

export async function updateSubStrand(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "sub-strand or sub-topic");
  const name = cleanRequiredText(formData.get("name"), "Sub-strand or sub-topic name", 180);
  if ("error" in id) return error(id.error);
  if ("error" in name) return error(name.error);

  return withAdmin(async (supabase) => {
    const curriculum = await getCurriculumReadRepository();
    const current = await curriculum.getSubStrandParent(id.value).catch(() => null);
    if (!current) return error("Sub-strand or sub-topic not found.");
    const existing = await curriculum.listSubStrandNames(current.parent_id).catch(() => null);
    if (!existing) return error("Could not check existing sub-strands or sub-topics.");
    if (hasDuplicate(namedRows(existing), name.value, id.value)) {
      return error("A sub-strand or sub-topic with this exact name already exists here.");
    }

    let { error: updateError } = await supabase
      .from("sub_strands")
      .update({
        name: name.value,
        source_code: null,
        verification_status: "unverified",
        outcome_status: "unverified",
        source_ref: null,
        source_metadata: {},
      })
      .eq("id", id.value);
    if (updateError?.code === "PGRST204") {
      const legacyResult = await supabase
        .from("sub_strands")
        .update({ name: name.value })
        .eq("id", id.value);
      updateError = legacyResult.error;
    }
    if (updateError) return error("Could not update the sub-strand or sub-topic.");
    return success("Sub-strand or sub-topic updated; verification is still required.", "/admin/curriculum");
  });
}

export async function deleteSubStrand(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "sub-strand or sub-topic");
  if ("error" in id) return error(id.error);

  return withAdmin(async (supabase) => {
    const count = await (await getCurriculumReadRepository()).countLearningOutcomes(id.value).catch(() => null);
    if (count === null) return error("Could not verify whether this record is in use.");
    if ((count ?? 0) > 0) {
      return error(
        "This sub-strand or sub-topic cannot be deleted because it has " +
          String(count) +
          " learning outcomes/objectives. Remove those safely first."
      );
    }

    const examCount = await getAdminReportingRepository()
      .then((repository) => repository.countExamsReferencingSubStrand(id.value))
      .catch(() => null);
    if (examCount === null) return error("Could not check saved exam references.");
    if ((examCount ?? 0) > 0) {
      return error(
        "This sub-strand or sub-topic cannot be deleted because saved exams reference its UUID."
      );
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("sub_strands")
      .delete()
      .eq("id", id.value)
      .select("id");
    if (deleteError) return error("Could not delete the sub-strand or sub-topic.");
    if (!deleted?.length) return error("Sub-strand or sub-topic not found.");
    return success("Sub-strand or sub-topic deleted.", "/admin/curriculum");
  });
}

export async function createLearningOutcome(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const subStrandId = cleanId(formData.get("subStrandId"), "sub-strand or sub-topic");
  const description = cleanRequiredMultiline(
    formData.get("description"),
    "Learning outcome or objective",
    1000
  );
  if ("error" in subStrandId) return error(subStrandId.error);
  if ("error" in description) return error(description.error);

  return withAdmin(async (supabase) => {
    const existing = await (await getCurriculumReadRepository())
      .listLearningOutcomeDescriptions(subStrandId.value).catch(() => null);
    if (!existing) return error("Could not check existing learning outcomes or objectives.");
    if (hasDuplicate(outcomeRows(existing), description.value)) {
      return error("This learning outcome or objective already exists here.");
    }

    const { error: insertError } = await supabase.from("learning_outcomes").insert({
      sub_strand_id: subStrandId.value,
      description: description.value,
    });
    if (insertError) return error("Could not add the learning outcome or objective.");
    return success("Learning outcome or objective added as unverified.", "/admin/curriculum");
  });
}

export async function updateLearningOutcome(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "learning outcome or objective");
  const description = cleanRequiredMultiline(
    formData.get("description"),
    "Learning outcome or objective",
    1000
  );
  if ("error" in id) return error(id.error);
  if ("error" in description) return error(description.error);

  return withAdmin(async (supabase) => {
    const curriculum = await getCurriculumReadRepository();
    const current = await curriculum.getLearningOutcomeParent(id.value).catch(() => null);
    if (!current) return error("Learning outcome or objective not found.");
    const existing = await curriculum.listLearningOutcomeDescriptions(current.parent_id).catch(() => null);
    if (!existing) return error("Could not check existing learning outcomes or objectives.");
    if (hasDuplicate(outcomeRows(existing), description.value, id.value)) {
      return error("This learning outcome or objective already exists here.");
    }

    let { error: updateError } = await supabase
      .from("learning_outcomes")
      .update({
        description: description.value,
        verification_status: "unverified",
        source_ref: null,
        source_metadata: {},
      })
      .eq("id", id.value);
    if (updateError?.code === "PGRST204") {
      const legacyResult = await supabase
        .from("learning_outcomes")
        .update({ description: description.value })
        .eq("id", id.value);
      updateError = legacyResult.error;
    }
    if (updateError) return error("Could not update the learning outcome or objective.");
    return success(
      "Learning outcome or objective updated; verification is still required.",
      "/admin/curriculum"
    );
  });
}

export async function deleteLearningOutcome(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const id = cleanId(formData.get("id"), "learning outcome or objective");
  if ("error" in id) return error(id.error);

  return withAdmin(async (supabase) => {
    const { data: deleted, error: deleteError } = await supabase
      .from("learning_outcomes")
      .delete()
      .eq("id", id.value)
      .select("id");
    if (deleteError) return error("Could not delete the learning outcome or objective.");
    if (!deleted?.length) return error("Learning outcome or objective not found.");
    return success("Learning outcome or objective deleted.", "/admin/curriculum");
  });
}
