import "server-only";

import { withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type { AppSettingsWriteRepository } from "./contracts.ts";

export class PostgresAppSettingsWriteRepository implements AppSettingsWriteRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  async upsertExamPackagePrice(amount: number, updatedAt: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) => client.query(
      `insert into public.app_settings (key, value, updated_at)
       values ('exam_package_price', jsonb_build_object('amount', $1::integer, 'currency', 'KES'), $2::timestamptz)
       on conflict (key) do update
       set value = excluded.value, updated_at = excluded.updated_at`,
      [amount, updatedAt]
    ));
  }
}
