import "server-only";

import { queryRows, withAuthenticatedTransaction, withTrustedTransaction } from "../db/postgres-client.ts";
import type { UserRole } from "../auth/session.ts";
import type { AuthorizedExamDocumentRow, ExamDocumentAccessMetadata, ExamDocumentReadRepository, ExamReadRepository, RecentTeacherExam, TeacherExamForEditing, TeacherExamListItem, TeacherExamPaymentMetadata, TrustedExamReadRepository } from "./contracts.ts";

type FlatRecent = Omit<RecentTeacherExam, "subjects" | "grades"> & { subject_name: string | null; grade_name: string | null };
type FlatList = Omit<TeacherExamListItem, "subjects" | "grades"> & { subject_name: string | null; grade_name: string | null };
type EditRow = Omit<TeacherExamForEditing, "marking_schemes">;

function relations<Row extends { subject_name: string | null; grade_name: string | null }>(row: Row) {
  const { subject_name, grade_name, ...exam } = row;
  return { ...exam, subjects: subject_name === null ? null : { name: subject_name }, grades: grade_name === null ? null : { name: grade_name } };
}

export class PostgresExamReadRepository implements ExamReadRepository, ExamDocumentReadRepository {
  private readonly userId: string;
  private readonly teacherId: string;
  private readonly role: UserRole | null;
  constructor(userId: string, teacherId: string | null, role: UserRole | null = "teacher") { this.userId = userId; this.teacherId = teacherId ?? ""; this.role = role; }

  listRecentTeacherExams(limit: number): Promise<RecentTeacherExam[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid exam list limit.");
    return withAuthenticatedTransaction(this.userId, async (client) => (await queryRows<FlatRecent>(client,
      `select e.id, e.exam_type, e.status, e.created_at::text, s.name as subject_name, g.name as grade_name
       from public.exams e left join public.subjects s on s.id = e.subject_id left join public.grades g on g.id = e.grade_id
       where e.teacher_id = $1::uuid order by e.created_at desc limit $2::integer`, [this.teacherId, limit])).map(relations) as RecentTeacherExam[]);
  }

  listTeacherExams(): Promise<TeacherExamListItem[]> {
    return withAuthenticatedTransaction(this.userId, async (client) => (await queryRows<FlatList>(client,
      `select e.id, e.exam_type, e.marks, e.duration, e.difficulty, e.term, e.year, e.status, e.created_at::text,
              s.name as subject_name, g.name as grade_name
       from public.exams e left join public.subjects s on s.id = e.subject_id left join public.grades g on g.id = e.grade_id
       where e.teacher_id = $1::uuid order by e.created_at desc`, [this.teacherId])).map(relations) as TeacherExamListItem[]);
  }

  getTeacherExamForEditing(id: string): Promise<TeacherExamForEditing | null> {
    return withAuthenticatedTransaction(this.userId, async (client) => {
      const exams = await queryRows<EditRow>(client,
        `select id, teacher_id, subject_id, grade_id, exam_type, difficulty, status, revision, content
         from public.exams where id = $1::uuid and teacher_id = $2::uuid`, [id, this.teacherId]);
      if (exams.length === 0) return null;
      if (exams.length !== 1) throw new Error("Exam lookup returned an unexpected row count.");
      const schemes = await queryRows<{ content: TeacherExamForEditing["marking_schemes"][number]["content"] }>(client,
        `select ms.content from public.marking_schemes ms join public.exams e on e.id = ms.exam_id
         where ms.exam_id = $1::uuid and e.teacher_id = $2::uuid order by ms.created_at`, [id, this.teacherId]);
      return { ...exams[0], marking_schemes: schemes };
    });
  }

  async getTeacherExamPaymentMetadata(id: string): Promise<TeacherExamPaymentMetadata | null> {
    try {
      return await withAuthenticatedTransaction(this.userId, async (client) => {
        const rows = await queryRows<TeacherExamPaymentMetadata>(client,
          "select id, status from public.exams where id = $1::uuid and teacher_id = $2::uuid", [id, this.teacherId]);
        if (rows.length > 1) throw new Error("Exam payment metadata lookup returned an unexpected row count.");
        return rows[0] ?? null;
      });
    } catch {
      return null;
    }
  }

  getDocumentAccessMetadata(id: string): Promise<ExamDocumentAccessMetadata | null> {
    return withAuthenticatedTransaction(this.userId, async (client) => {
      const rows = this.role === "teacher"
        ? await queryRows<ExamDocumentAccessMetadata>(client,
          "select id, status, revision from public.exams where id = $1::uuid and teacher_id = $2::uuid", [id, this.teacherId])
        : await queryRows<ExamDocumentAccessMetadata>(client,
          "select id, status, revision from public.exams where id = $1::uuid", [id]);
      if (rows.length > 1) throw new Error("Exam access lookup returned an unexpected row count.");
      return rows[0] ?? null;
    });
  }

  getAuthorizedExamDocument(id: string, includeMarking: boolean): Promise<AuthorizedExamDocumentRow | null> {
    return withAuthenticatedTransaction(this.userId, async (client) => {
      const rows = this.role === "teacher"
        ? await queryRows<Omit<AuthorizedExamDocumentRow, "teachers" | "marking_schemes"> & { school: string | null }>(client,
          `select e.id, e.exam_type, e.marks, e.duration, e.term, e.year, e.content, t.school
           from public.exams e left join public.teachers t on t.id = e.teacher_id
           where e.id = $1::uuid and e.teacher_id = $2::uuid`, [id, this.teacherId])
        : await queryRows<Omit<AuthorizedExamDocumentRow, "teachers" | "marking_schemes"> & { school: string | null }>(client,
          `select e.id, e.exam_type, e.marks, e.duration, e.term, e.year, e.content, t.school
           from public.exams e left join public.teachers t on t.id = e.teacher_id where e.id = $1::uuid`, [id]);
      if (rows.length === 0) return null;
      if (rows.length > 1) throw new Error("Exam document lookup returned an unexpected row count.");
      const { school, ...exam } = rows[0];
      let marking_schemes: Array<{ content: unknown }> = [];
      if (includeMarking) {
        marking_schemes = this.role === "teacher"
          ? await queryRows<{ content: unknown }>(client,
            `select ms.content from public.marking_schemes ms join public.exams e on e.id = ms.exam_id
             where ms.exam_id = $1::uuid and e.teacher_id = $2::uuid order by ms.created_at`, [id, this.teacherId])
          : await queryRows<{ content: unknown }>(client,
            `select ms.content from public.marking_schemes ms where ms.exam_id = $1::uuid order by ms.created_at`, [id]);
      }
      return { ...exam, teachers: { school }, marking_schemes };
    });
  }
}

export class PostgresTrustedExamReadRepository implements TrustedExamReadRepository {
  async teacherOwnsExam(id: string, teacherId: string): Promise<boolean> {
    try {
      return await withTrustedTransaction(async (client) => {
        const rows = await queryRows<{ id: string }>(client,
          "select id from public.exams where id = $1::uuid and teacher_id = $2::uuid", [id, teacherId]);
        if (rows.length > 1) throw new Error("Exam ownership lookup returned an unexpected row count.");
        return rows.length === 1;
      });
    } catch {
      return false;
    }
  }
}
