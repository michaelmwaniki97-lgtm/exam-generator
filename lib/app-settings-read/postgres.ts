import "server-only";

import { PaymentError } from "../payments/core.ts";
import { queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { examPackagePriceFromSetting, type AppSettingRow, type AppSettingsReadRepository } from "./contracts.ts";

export class PostgresAppSettingsReadRepository implements AppSettingsReadRepository {
  async getExamPackagePrice(): Promise<number> {
    try {
      const rows = await withTrustedTransaction((client) => queryRows<AppSettingRow>(client,
        "select value from public.app_settings where key = $1", ["exam_package_price"]));
      if (rows.length > 1) throw new Error("App setting lookup returned multiple rows.");
      return examPackagePriceFromSetting(rows[0] ?? null);
    } catch (error) {
      if (error instanceof PaymentError) throw error;
      throw new PaymentError("NOT_CONFIGURED", "Exam download pricing is not configured.");
    }
  }
}
