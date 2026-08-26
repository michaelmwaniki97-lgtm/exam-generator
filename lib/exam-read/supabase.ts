import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExamReadRepository, RecentTeacherExam, TeacherExamForEditing, TeacherExamListItem } from "./contracts.ts";

const RECENT_COLUMNS = "id, exam_type, status, created_at, subjects(name), grades(name)";
const LIST_COLUMNS = "id, exam_type, marks, duration, difficulty, term, year, status, created_at, subjects(name), grades(name)";
const EDIT_COLUMNS = "id, teacher_id, subject_id, grade_id, exam_type, difficulty, status, revision, content, marking_schemes(content)";

export class SupabaseExamReadRepository implements ExamReadRepository {
  private readonly client: SupabaseClient;
  private readonly teacherId: string;
  constructor(client: SupabaseClient, teacherId: string) { this.client = client; this.teacherId = teacherId; }

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
}
