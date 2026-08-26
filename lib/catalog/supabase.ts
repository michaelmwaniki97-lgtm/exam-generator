import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogOptionRow, CatalogRepository, GradeRow, WizardGradeRow } from "./contracts.ts";

function failed(message: string): Error { return new Error(message); }

export class SupabaseCatalogRepository implements CatalogRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async listWizardGrades(): Promise<WizardGradeRow[]> {
    const { data, error } = await this.client.from("grades").select("id, name, level, sort_order").order("sort_order").order("created_at");
    if (error) throw failed("Could not load grades.");
    return (data ?? []).map((row) => ({ id: row.id, name: row.name, level: row.level, sort_order: row.sort_order ?? 0 }));
  }

  async listGradesByCreation(): Promise<GradeRow[]> {
    const { data, error } = await this.client.from("grades").select("id, name, level").order("created_at");
    if (error) throw failed("Could not load grades.");
    return data ?? [];
  }

  async listGradeOptionsByName(): Promise<CatalogOptionRow[]> {
    const { data, error } = await this.client.from("grades").select("id, name").order("name");
    if (error) throw failed("Could not load grades.");
    return data ?? [];
  }

  async listGradeNames(): Promise<CatalogOptionRow[]> {
    const { data, error } = await this.client.from("grades").select("id, name");
    if (error) throw failed("Could not load grades.");
    return data ?? [];
  }

  async getGradeById(id: string): Promise<GradeRow | null> {
    const { data, error } = await this.client.from("grades").select("id, name, level").eq("id", id).maybeSingle();
    if (error) throw failed("Could not load grade.");
    return data;
  }

  async gradeExists(id: string): Promise<boolean> {
    const { data, error } = await this.client.from("grades").select("id").eq("id", id).maybeSingle();
    if (error) throw failed("Could not load grade.");
    return Boolean(data);
  }

  async listSubjectsByName(): Promise<CatalogOptionRow[]> {
    const { data, error } = await this.client.from("subjects").select("id, name").order("name");
    if (error) throw failed("Could not load subjects.");
    return data ?? [];
  }

  async listSubjectNames(): Promise<CatalogOptionRow[]> {
    const { data, error } = await this.client.from("subjects").select("id, name");
    if (error) throw failed("Could not load subjects.");
    return data ?? [];
  }

  async getSubjectById(id: string): Promise<CatalogOptionRow | null> {
    const { data, error } = await this.client.from("subjects").select("id, name").eq("id", id).maybeSingle();
    if (error) throw failed("Could not load subject.");
    return data;
  }

  async subjectExists(id: string): Promise<boolean> {
    const { data, error } = await this.client.from("subjects").select("id").eq("id", id).maybeSingle();
    if (error) throw failed("Could not load subject.");
    return Boolean(data);
  }

  async countSubjects(): Promise<number> {
    const { count, error } = await this.client.from("subjects").select("id", { count: "exact", head: true });
    if (error) throw failed("Could not count subjects.");
    return count ?? 0;
  }
}
