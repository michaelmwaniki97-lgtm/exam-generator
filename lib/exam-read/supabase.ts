import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "../auth/session.ts";
import type { AuthorizedExamDocumentRow, ExamDocumentAccessMetadata, ExamDocumentReadRepository, ExamReadRepository, RecentTeacherExam, TeacherExamForEditing, TeacherExamListItem } from "./contracts.ts";

const RECENT_COLUMNS = "id, exam_type, status, created_at, subjects(name), grades(name)";
const LIST_COLUMNS = "id, exam_type, marks, duration, difficulty, term, year, status, created_at, subjects(name), grades(name)";
const EDIT_COLUMNS = "id, teacher_id, subject_id, grade_id, exam_type, difficulty, status, revision, content, marking_schemes(content)";
const ACCESS_COLUMNS = "id, status, revision";
const DOCUMENT_COLUMNS = "id, exam_type, marks, duration, term, year, content, teachers(school)";
const MARKING_DOCUMENT_COLUMNS = `${DOCUMENT_COLUMNS}, marking_schemes(content)`;

export class SupabaseExamReadRepository implements ExamReadRepository, ExamDocumentReadRepository {
  private readonly client: SupabaseClient;
  private readonly teacherId: string;
  private readonly role: UserRole | null;
  constructor(client: SupabaseClient, teacherId: string | null, role: UserRole | null = "teacher") { this.client = client; this.teacherId = teacherId ?? ""; this.role = role; }

  async listRecentTeacherExams(limit: number): Promise<RecentTeacherExam[]> {
    const { data, error } = await this.client.from("exams").select(RECENT_COLUMNS).eq("teacher_id", this.teacherId).order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error("Could not load recent exams.");
    return (data ?? []) as unknown as RecentTeacherExam[];
  }

  async listTeacherExams(): Promise<TeacherExamListItem[]> {
    const { data, error } = await this.client.from("exams").select(LIST_COLUMNS).eq("teacher_id", this.teacherId).order("created_at", { ascending: false });
    if (error) throw new Error("Could not load exams.");
    return (data ?? []) as unknown as TeacherExamListItem[];
  }

  async getTeacherExamForEditing(id: string): Promise<TeacherExamForEditing | null> {
    const { data, error } = await this.client.from("exams").select(EDIT_COLUMNS).eq("id", id).eq("teacher_id", this.teacherId).maybeSingle();
    if (error) throw new Error("Could not load exam for editing.");
    return data as unknown as TeacherExamForEditing | null;
  }

  async getDocumentAccessMetadata(id: string): Promise<ExamDocumentAccessMetadata | null> {
    let query = this.client.from("exams").select(ACCESS_COLUMNS).eq("id", id);
    if (this.role === "teacher") query = query.eq("teacher_id", this.teacherId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error("Could not authorize exam document access.");
    return data as ExamDocumentAccessMetadata | null;
  }

  async getAuthorizedExamDocument(id: string, includeMarking: boolean): Promise<AuthorizedExamDocumentRow | null> {
    let query = this.client.from("exams").select(includeMarking ? MARKING_DOCUMENT_COLUMNS : DOCUMENT_COLUMNS).eq("id", id);
    if (this.role === "teacher") query = query.eq("teacher_id", this.teacherId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error("Could not load authorized exam document.");
    if (!data) return null;
    const row = data as unknown as Omit<AuthorizedExamDocumentRow, "marking_schemes"> & { marking_schemes?: Array<{ content: unknown }> };
    return { ...row, marking_schemes: row.marking_schemes ?? [] };
  }
}
