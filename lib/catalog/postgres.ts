import "server-only";

import { queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type { CatalogOptionRow, CatalogRepository, GradeRow, WizardGradeRow } from "./contracts.ts";

function one<Row>(rows: Row[]): Row | null {
  if (rows.length > 1) throw new Error("Catalog query returned an unexpected row count.");
  return rows[0] ?? null;
}

export class PostgresCatalogRepository implements CatalogRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  listWizardGrades() {
    return withAuthenticatedTransaction(this.userId, (client) => queryRows<WizardGradeRow>(client,
      "select id, name, level, coalesce(sort_order, 0)::integer as sort_order from public.grades order by sort_order, created_at", []));
  }

  listGradesByCreation() {
    return withAuthenticatedTransaction(this.userId, (client) => queryRows<GradeRow>(client,
      "select id, name, level from public.grades order by created_at", []));
  }

  listGradeOptionsByName() {
    return withAuthenticatedTransaction(this.userId, (client) => queryRows<CatalogOptionRow>(client,
      "select id, name from public.grades order by name", []));
  }

  listGradeNames() {
    return withAuthenticatedTransaction(this.userId, (client) => queryRows<CatalogOptionRow>(client,
      "select id, name from public.grades", []));
  }

  getGradeById(id: string) {
    return withAuthenticatedTransaction(this.userId, async (client) => one(await queryRows<GradeRow>(client,
      "select id, name, level from public.grades where id = $1::uuid", [id])));
  }

  async gradeExists(id: string) {
    return withAuthenticatedTransaction(this.userId, async (client) => Boolean(one(await queryRows<{ id: string }>(client,
      "select id from public.grades where id = $1::uuid", [id]))));
  }

  listSubjectsByName() {
    return withAuthenticatedTransaction(this.userId, (client) => queryRows<CatalogOptionRow>(client,
      "select id, name from public.subjects order by name", []));
  }

  listSubjectNames() {
    return withAuthenticatedTransaction(this.userId, (client) => queryRows<CatalogOptionRow>(client,
      "select id, name from public.subjects", []));
  }

  getSubjectById(id: string) {
    return withAuthenticatedTransaction(this.userId, async (client) => one(await queryRows<CatalogOptionRow>(client,
      "select id, name from public.subjects where id = $1::uuid", [id])));
  }

  async subjectExists(id: string) {
    return withAuthenticatedTransaction(this.userId, async (client) => Boolean(one(await queryRows<{ id: string }>(client,
      "select id from public.subjects where id = $1::uuid", [id]))));
  }

  async countSubjects() {
    return withAuthenticatedTransaction(this.userId, async (client) => {
      const row = one(await queryRows<{ count: string }>(client, "select count(*)::text as count from public.subjects", []));
      return Number(row?.count ?? 0);
    });
  }
}
