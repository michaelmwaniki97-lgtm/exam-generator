export interface AppSettingsWriteRepository {
  upsertExamPackagePrice(amount: number, updatedAt: string): Promise<void>;
}
