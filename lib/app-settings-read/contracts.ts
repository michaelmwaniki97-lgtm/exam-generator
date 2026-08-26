import { PaymentError, validateExamPackagePrice } from "../payments/core.ts";

export type AppSettingRow = { value: unknown };

export function examPackagePriceFromSetting(row: AppSettingRow | null): number {
  if (!row || typeof row.value !== "object" || row.value === null || Array.isArray(row.value)) {
    throw new PaymentError("NOT_CONFIGURED", "Exam download pricing is not configured.");
  }
  return validateExamPackagePrice((row.value as Record<string, unknown>).amount);
}

export interface AppSettingsReadRepository {
  getExamPackagePrice(): Promise<number>;
}
