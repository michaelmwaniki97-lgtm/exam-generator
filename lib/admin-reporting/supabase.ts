import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminDependencies,
  AdminReportingRepository,
  AdminTextbookMetadata,
} from "./contracts.ts";

function fail(): never {
  throw new Error("Could not load administrator reporting data.");
}

function exact(count: number | null): number {
  return count ?? 0;
}

export class SupabaseAdminReportingRepository implements AdminReportingRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async countDashboardExams(): Promise<number> {
    const { count, error } = await this.client
      .from("exams")
      .select("id", { count: "exact", head: true });
    if (error) fail();
    return exact(count);
  }

  private async dependencies(column: "subject_id" | "grade_id", id: string): Promise<AdminDependencies> {
    const [{ count: curriculum, error: curriculumError }, { count: textbooks, error: textbookError }, { count: exams, error: examError }] =
      await Promise.all([
        this.client.from("strands").select("id", { count: "exact", head: true }).eq(column, id),
        this.client.from("textbooks").select("id", { count: "exact", head: true }).eq(column, id),
        this.client.from("exams").select("id", { count: "exact", head: true }).eq(column, id),
      ]);
    if (curriculumError || textbookError || examError) fail();
    return { curriculum: exact(curriculum), textbooks: exact(textbooks), exams: exact(exams) };
  }

  getSubjectDependencies(subjectId: string) {
    return this.dependencies("subject_id", subjectId);
  }

  getGradeDependencies(gradeId: string) {
    return this.dependencies("grade_id", gradeId);
  }

  async countExamsReferencingSubStrand(subStrandId: string): Promise<number> {
    const { count, error } = await this.client
      .from("exams")
      .select("id", { count: "exact", head: true })
      .contains("content", { meta: { topicIds: [subStrandId] } });
    if (error) fail();
    return exact(count);
  }

  async listTextbookMetadata(): Promise<AdminTextbookMetadata[]> {
    const { data, error } = await this.client
      .from("textbooks")
      .select("id, name, publisher, subject:subjects(name), grade:grades(name)")
      .order("name");
    if (error) fail();
    return (data ?? []) as unknown as AdminTextbookMetadata[];
  }
}
