import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeacherProfileUpdate, TeacherProfileWriteRepository } from "./contracts.ts";

export class SupabaseTeacherProfileWriteRepository implements TeacherProfileWriteRepository {
  private readonly client: SupabaseClient;
  private readonly userId: string;
  constructor(client: SupabaseClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  async updateProfile(profile: TeacherProfileUpdate): Promise<void> {
    const { error } = await this.client.from("teachers").update(profile).eq("user_id", this.userId);
    if (error) throw new Error("Teacher profile write failed.");
  }
}
