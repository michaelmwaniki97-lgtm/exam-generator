import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogWriteRepository } from "./contracts.ts";

function failed(): never {
  throw new Error("Catalog write failed.");
}

export class SupabaseCatalogWriteRepository implements CatalogWriteRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async createSubject(name: string): Promise<void> {
    const { error } = await this.client.from("subjects").insert({ name });
    if (error) failed();
  }

  async updateSubject(id: string, name: string): Promise<void> {
    const { error } = await this.client.from("subjects").update({ name }).eq("id", id);
    if (error) failed();
  }

  async deleteSubject(id: string): Promise<boolean> {
    const { data, error } = await this.client.from("subjects").delete().eq("id", id).select("id");
    if (error) failed();
    return Boolean(data?.length);
  }

  async createGrade(name: string, level: string): Promise<void> {
    const { error } = await this.client.from("grades").insert({ name, level });
    if (error) failed();
  }

  async updateGrade(id: string, name: string, level: string): Promise<void> {
    const { error } = await this.client.from("grades").update({ name, level }).eq("id", id);
    if (error) failed();
  }

  async deleteGrade(id: string): Promise<boolean> {
    const { data, error } = await this.client.from("grades").delete().eq("id", id).select("id");
    if (error) failed();
    return Boolean(data?.length);
  }
}
