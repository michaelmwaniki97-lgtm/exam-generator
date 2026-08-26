import "server-only";

import { queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type { ExamReadRepository, RecentTeacherExam, TeacherExamForEditing, TeacherExamListItem } from "./contracts.ts";

type FlatRecent = Omit<RecentTeacherExam, "subjects" | "grades"> & { subject_name: string | null; grade_name: string | null };
type FlatList = Omit<TeacherExamListItem, "subjects" | "grades"> & { subject_name: string | null; grade_name: string | null };
type EditRow = Omit<TeacherExamForEditing, "marking_schemes">;

function relations<Row extends { subject_name: string | null; grade_name: string | null }>(row: Row) {
  const { subject_name, grade_name, ...exam } = row;
  return { ...exam, subjects: subject_name === null ? null : { name: subject_name }, grades: grade_name === null ? null : { name: grade_name } };
}

export class PostgresExamReadRepository implements ExamReadRepository {
  private readonly userId: string;
  private readonly teacherId: string;
  constructor(userId: string, teacherId: string) { this.userId = userId; this.teacherId = teacherId; }

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
}
