import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurriculumWriteRepository } from "./contracts.ts";

type Client = SupabaseClient;

function failed(): never {
  throw new Error("Curriculum write failed.");
}

export class SupabaseCurriculumWriteRepository implements CurriculumWriteRepository {
  private readonly client: Client;
  constructor(client: Client) { this.client = client; }

  async createStrand(gradeId: string, subjectId: string, name: string): Promise<void> {
    const { error } = await this.client.from("strands").insert({
      grade_id: gradeId,
      subject_id: subjectId,
      name,
    });
    if (error) failed();
  }

  async updateStrand(id: string, name: string): Promise<void> {
    let { error } = await this.client.from("strands").update({
      name,
      source_code: null,
      verification_status: "unverified",
      outcome_status: "unverified",
      source_ref: null,
      source_metadata: {},
    }).eq("id", id);
    if (error?.code === "PGRST204") {
      ({ error } = await this.client.from("strands").update({ name }).eq("id", id));
    }
    if (error) failed();
  }

  async deleteStrand(id: string): Promise<boolean> {
    const { data, error } = await this.client.from("strands").delete().eq("id", id).select("id");
    if (error) failed();
    return Boolean(data?.length);
  }

  async createSubStrand(strandId: string, name: string): Promise<void> {
    const { error } = await this.client.from("sub_strands").insert({ strand_id: strandId, name });
    if (error) failed();
  }

  async updateSubStrand(id: string, name: string): Promise<void> {
    let { error } = await this.client.from("sub_strands").update({
      name,
      source_code: null,
      verification_status: "unverified",
      outcome_status: "unverified",
      source_ref: null,
      source_metadata: {},
    }).eq("id", id);
    if (error?.code === "PGRST204") {
      ({ error } = await this.client.from("sub_strands").update({ name }).eq("id", id));
    }
    if (error) failed();
  }

  async deleteSubStrand(id: string): Promise<boolean> {
    const { data, error } = await this.client.from("sub_strands").delete().eq("id", id).select("id");
    if (error) failed();
    return Boolean(data?.length);
  }

  async createLearningOutcome(subStrandId: string, description: string): Promise<void> {
    const { error } = await this.client.from("learning_outcomes").insert({
      sub_strand_id: subStrandId,
      description,
    });
    if (error) failed();
  }

  async updateLearningOutcome(id: string, description: string): Promise<void> {
    let { error } = await this.client.from("learning_outcomes").update({
      description,
      verification_status: "unverified",
      source_ref: null,
      source_metadata: {},
    }).eq("id", id);
    if (error?.code === "PGRST204") {
      ({ error } = await this.client.from("learning_outcomes").update({ description }).eq("id", id));
    }
    if (error) failed();
  }

  async deleteLearningOutcome(id: string): Promise<boolean> {
    const { data, error } = await this.client.from("learning_outcomes").delete().eq("id", id).select("id");
    if (error) failed();
    return Boolean(data?.length);
  }
}
