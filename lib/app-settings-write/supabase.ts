import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppSettingsWriteRepository } from "./contracts.ts";

export class SupabaseAppSettingsWriteRepository implements AppSettingsWriteRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async upsertExamPackagePrice(amount: number, updatedAt: string): Promise<void> {
    const { error } = await this.client.from("app_settings").upsert({
      key: "exam_package_price",
      value: { amount, currency: "KES" },
      updated_at: updatedAt,
    }, { onConflict: "key" });
    if (error) throw new Error("App settings write failed.");
  }
}
