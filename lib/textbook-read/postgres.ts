import "server-only";

import type { PoolClient } from "pg";
import { queryRows, withAuthenticatedTransaction, withTrustedTransaction } from "../db/postgres-client.ts";
import type { AdminTextbookDocument, AdminTextbookReadRepository, GroundingTextbook, TeacherTextbookReadRepository, TextbookNameRow } from "./contracts.ts";

type Access = "admin" | "teacher";

export class PostgresTextbookReadRepository implements AdminTextbookReadRepository, TeacherTextbookReadRepository {
  private readonly userId: string;
  private readonly access: Access;
  constructor(userId: string, access: Access) { this.userId = userId; this.access = access; }

  private async authorize(expected: Access): Promise<void> {
    if (this.access !== expected) throw new Error(expected === "admin" ? "Administrator access is required." : "Teacher access is required.");
    const allowed = await withAuthenticatedTransaction(this.userId, async (client) => {
      if (expected === "admin") return (await queryRows<{ allowed: boolean }>(client, "select public.is_admin() as allowed", []))[0]?.allowed ?? false;
      const rows = await queryRows<{ id: string }>(client,
        "select id from public.teachers where user_id = $1::uuid and not public.is_admin()", [this.userId]);
      return rows.length === 1;
    });
    if (!allowed) throw new Error(expected === "admin" ? "Administrator access is required." : "Teacher access is required.");
  }

  private async admin<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    await this.authorize("admin");
    return withTrustedTransaction(work);
  }

  private async teacher<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    await this.authorize("teacher");
    return withTrustedTransaction(work);
  }

  listTextbooksForDuplicateCheck(subjectId: string, gradeId: string): Promise<TextbookNameRow[]> {
    return this.admin((client) => queryRows<TextbookNameRow>(client,
      "select id, name from public.textbooks where subject_id = $1::uuid and grade_id = $2::uuid", [subjectId, gradeId]));
  }

  async textbookExists(textbookId: string): Promise<boolean> {
    return this.admin(async (client) => (await queryRows<{ id: string }>(client,
      "select id from public.textbooks where id = $1::uuid", [textbookId])).length === 1);
  }

  listAdminTextbookDocuments(): Promise<AdminTextbookDocument[]> {
    return this.admin(async (client) => {
      const rows = await queryRows<Omit<AdminTextbookDocument, "file_size" | "created_at"> & { file_size: string | number; created_at: Date | string }>(client,
        `select id, textbook_id, original_filename, file_size, processing_status, processing_error,
                page_count, chunk_count, source_type, created_at
           from public.textbook_documents
          order by created_at desc`, []);
      return rows.map((row) => ({ ...row, file_size: Number(row.file_size), created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at }));
    });
  }

  getTextbookForGrounding(textbookId: string, subjectId: string, gradeId: string): Promise<GroundingTextbook | null> {
    return this.teacher(async (client) => {
      const rows = await queryRows<GroundingTextbook>(client,
        "select id, name from public.textbooks where id = $1::uuid and subject_id = $2::uuid and grade_id = $3::uuid",
        [textbookId, subjectId, gradeId]);
      return rows[0] ?? null;
    });
  }

  getReadyDocumentId(textbookId: string, documentId?: string): Promise<string | null> {
    return this.teacher(async (client) => {
      const rows = await queryRows<{ id: string }>(client,
        `select id from public.textbook_documents
          where textbook_id = $1::uuid and processing_status = 'ready'
            and ($2::uuid is null or id = $2::uuid)
          order by processed_at desc
          limit 1`, [textbookId, documentId ?? null]);
      return rows[0]?.id ?? null;
    });
  }
}
