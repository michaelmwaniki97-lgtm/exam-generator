import "server-only";

import { queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type { CatalogWriteRepository } from "./contracts.ts";

type IdRow = { id: string };

export class PostgresCatalogWriteRepository implements CatalogWriteRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  async createSubject(name: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) =>
      client.query("insert into public.subjects (name) values ($1::text)", [name]));
  }

  async updateSubject(id: string, name: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) =>
      client.query("update public.subjects set name = $2::text where id = $1::uuid", [id, name]));
  }

  async deleteSubject(id: string): Promise<boolean> {
    return withAuthenticatedTransaction(this.userId, async (client) =>
      (await queryRows<IdRow>(client, "delete from public.subjects where id = $1::uuid returning id", [id])).length > 0);
  }

  async createGrade(name: string, level: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) =>
      client.query("insert into public.grades (name, level) values ($1::text, $2::text)", [name, level]));
  }

  async updateGrade(id: string, name: string, level: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) =>
      client.query("update public.grades set name = $2::text, level = $3::text where id = $1::uuid", [id, name, level]));
  }

  async deleteGrade(id: string): Promise<boolean> {
    return withAuthenticatedTransaction(this.userId, async (client) =>
      (await queryRows<IdRow>(client, "delete from public.grades where id = $1::uuid returning id", [id])).length > 0);
  }
}
