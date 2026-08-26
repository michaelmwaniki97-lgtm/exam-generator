import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminStrand,
  CurriculumNameRow,
  CurriculumReadRepository,
  OutcomeNameRow,
  ParentRow,
  SelectionTopic,
  WizardStrand,
  WizardSubjectContext,
} from "./contracts.ts";

function fail(message: string): never { throw new Error(message); }

export class SupabaseCurriculumReadRepository implements CurriculumReadRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async listActiveGradeIds(): Promise<string[]> {
    const { data, error } = await this.client.from("strands").select("grade_id").eq("is_active", true);
    if (error) fail("Could not load active curriculum contexts.");
    return (data ?? []).map((row) => row.grade_id);
  }

  async listSubjectContextsForGrade(gradeId: string): Promise<WizardSubjectContext[]> {
    const { data, error } = await this.client.from("strands")
      .select("grade_id, subject_id, is_active, verification_status, subjects(id, name)")
      .eq("grade_id", gradeId).eq("is_active", true).order("sort_order");
    if (error) fail("Could not load curriculum subjects.");
    return (data ?? []).map((row) => ({
      grade_id: row.grade_id,
      subject_id: row.subject_id,
      is_active: row.is_active,
      verification_status: row.verification_status,
      subject: row.subjects as unknown as { id: string; name: string } | null,
    }));
  }

  async listActiveHierarchy(gradeId: string, subjectId: string): Promise<WizardStrand[]> {
    const { data, error } = await this.client.from("strands")
      .select("id, name, sort_order, source_code, source_ref, verification_status, is_active, sub_strands(id, name, sort_order, source_code, source_ref, verification_status)")
      .eq("subject_id", subjectId).eq("grade_id", gradeId).eq("is_active", true).order("sort_order");
    if (error) fail("Could not load active curriculum.");
    return (data ?? []) as unknown as WizardStrand[];
  }

  async getSelectionTopics(ids: readonly string[]): Promise<SelectionTopic[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.client.from("sub_strands")
      .select("id, name, sort_order, source_ref, verification_status, strands(id, name, sort_order, subject_id, grade_id, is_active, source_ref, verification_status, strand_objectives(description, sort_order)), learning_outcomes(description, sort_order)")
      .in("id", [...ids]);
    if (error) fail("Could not load selected curriculum.");
    return (data ?? []) as unknown as SelectionTopic[];
  }

  async listAdminHierarchy(gradeId: string, subjectId: string): Promise<AdminStrand[]> {
    const modern = await this.client.from("strands")
      .select("id, name, sort_order, source_code, verification_status, outcome_status, sub_strands(id, name, sort_order, source_code, verification_status, learning_outcomes(id, description, sort_order, verification_status)), strand_objectives(id, description, label, sort_order, verification_status)")
      .eq("grade_id", gradeId).eq("subject_id", subjectId).eq("is_active", true).order("sort_order");
    if (!modern.error) return (modern.data ?? []) as unknown as AdminStrand[];

    const legacy = await this.client.from("strands")
      .select("id, name, sub_strands(id, name, learning_outcomes(id, description))")
      .eq("grade_id", gradeId).eq("subject_id", subjectId).order("name");
    if (legacy.error) fail("Could not load curriculum hierarchy.");
    return (legacy.data ?? []).map((strand) => ({
      ...strand,
      sort_order: 0,
      source_code: null,
      verification_status: "unverified" as const,
      outcome_status: "unverified" as const,
      strand_objectives: [],
      sub_strands: (strand.sub_strands ?? []).map((subStrand) => ({
        ...subStrand,
        sort_order: 0,
        source_code: null,
        verification_status: "unverified" as const,
        learning_outcomes: (subStrand.learning_outcomes ?? []).map((outcome) => ({
          ...outcome, sort_order: 0, verification_status: "unverified" as const,
        })),
      })),
    })) as unknown as AdminStrand[];
  }

  private async count(table: "strands" | "sub_strands" | "learning_outcomes", column: string, id: string) {
    const { count, error } = await this.client.from(table).select("id", { count: "exact", head: true }).eq(column, id);
    if (error) fail("Could not count curriculum records.");
    return count ?? 0;
  }

  countStrandsBySubject(id: string) { return this.count("strands", "subject_id", id); }
  countStrandsByGrade(id: string) { return this.count("strands", "grade_id", id); }
  countSubStrands(id: string) { return this.count("sub_strands", "strand_id", id); }
  countLearningOutcomes(id: string) { return this.count("learning_outcomes", "sub_strand_id", id); }

  async listStrandNames(gradeId: string, subjectId: string): Promise<CurriculumNameRow[]> {
    const { data, error } = await this.client.from("strands").select("id, name").eq("grade_id", gradeId).eq("subject_id", subjectId);
    if (error) fail("Could not load strand names."); return data ?? [];
  }

  async getStrandParent(id: string) {
    const { data, error } = await this.client.from("strands").select("id, grade_id, subject_id").eq("id", id).maybeSingle();
    if (error) fail("Could not load strand."); return data;
  }

  async listSubStrandNames(strandId: string): Promise<CurriculumNameRow[]> {
    const { data, error } = await this.client.from("sub_strands").select("id, name").eq("strand_id", strandId);
    if (error) fail("Could not load sub-strand names."); return data ?? [];
  }

  async getSubStrandParent(id: string): Promise<ParentRow | null> {
    const { data, error } = await this.client.from("sub_strands").select("id, strand_id").eq("id", id).maybeSingle();
    if (error) fail("Could not load sub-strand."); return data ? { id: data.id, parent_id: data.strand_id } : null;
  }

  async listLearningOutcomeDescriptions(subStrandId: string): Promise<OutcomeNameRow[]> {
    const { data, error } = await this.client.from("learning_outcomes").select("id, description").eq("sub_strand_id", subStrandId);
    if (error) fail("Could not load learning outcomes."); return data ?? [];
  }

  async getLearningOutcomeParent(id: string): Promise<ParentRow | null> {
    const { data, error } = await this.client.from("learning_outcomes").select("id, sub_strand_id").eq("id", id).maybeSingle();
    if (error) fail("Could not load learning outcome."); return data ? { id: data.id, parent_id: data.sub_strand_id } : null;
  }
}
