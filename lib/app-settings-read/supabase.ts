import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PaymentError } from "../payments/core.ts";
import { examPackagePriceFromSetting, type AppSettingsReadRepository } from "./contracts.ts";

export class SupabaseAppSettingsReadRepository implements AppSettingsReadRepository {
  private readonly client: SupabaseClient;
  constructor(client: SupabaseClient) { this.client = client; }

  async getExamPackagePrice(): Promise<number> {
    const { data, error } = await this.client.from("app_settings").select("value").eq("key", "exam_package_price").maybeSingle();
    if (error) throw new PaymentError("NOT_CONFIGURED", "Exam download pricing is not configured.");
    return examPackagePriceFromSetting(data);
  }
}
