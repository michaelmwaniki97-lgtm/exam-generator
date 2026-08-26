import "server-only";

import type { PoolClient } from "pg";
import { queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type {
  AdminDependencies,
  AdminReportingRepository,
  AdminTextbookMetadata,
} from "./contracts.ts";

type CountRow = { count: string };

function count(rows: CountRow[]): number {
  return Number(rows[0]?.count ?? 0);
}

export class PostgresAdminReportingRepository implements AdminReportingRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  private run<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    return withAuthenticatedTransaction(this.userId, work);
  }

  countDashboardExams(): Promise<number> {
    return this.run(async (client) => count(await queryRows<CountRow>(client,
      "select count(*)::text as count from public.exams where public.is_admin()", [])));
  }

  private dependencies(column: "subject_id" | "grade_id", id: string): Promise<AdminDependencies> {
    const queries = column === "subject_id"
      ? {
          curriculum: "select count(*)::text as count from public.strands where subject_id = $1::uuid and public.is_admin()",
          textbooks: "select count(*)::text as count from public.textbooks where subject_id = $1::uuid and public.is_admin()",
          exams: "select count(*)::text as count from public.exams where subject_id = $1::uuid and public.is_admin()",
        }
      : {
          curriculum: "select count(*)::text as count from public.strands where grade_id = $1::uuid and public.is_admin()",
          textbooks: "select count(*)::text as count from public.textbooks where grade_id = $1::uuid and public.is_admin()",
          exams: "select count(*)::text as count from public.exams where grade_id = $1::uuid and public.is_admin()",
        };
    return this.run(async (client) => {
      const curriculum = await queryRows<CountRow>(client, queries.curriculum, [id]);
      const textbooks = await queryRows<CountRow>(client, queries.textbooks, [id]);
      const exams = await queryRows<CountRow>(client, queries.exams, [id]);
      return { curriculum: count(curriculum), textbooks: count(textbooks), exams: count(exams) };
    });
  }

  getSubjectDependencies(subjectId: string) {
    return this.dependencies("subject_id", subjectId);
  }

  getGradeDependencies(gradeId: string) {
    return this.dependencies("grade_id", gradeId);
  }

  countExamsReferencingSubStrand(subStrandId: string): Promise<number> {
    return this.run(async (client) => count(await queryRows<CountRow>(client,
      "select count(*)::text as count from public.exams where content @> $1::jsonb and public.is_admin()",
      [JSON.stringify({ meta: { topicIds: [subStrandId] } })])));
  }

  listTextbookMetadata(): Promise<AdminTextbookMetadata[]> {
    return this.run((client) => queryRows<AdminTextbookMetadata>(client,
      `select t.id, t.name, t.publisher,
              jsonb_build_object('name', s.name) as subject,
              jsonb_build_object('name', g.name) as grade
         from public.textbooks t
         join public.subjects s on s.id = t.subject_id
         join public.grades g on g.id = t.grade_id
        where public.is_admin()
        order by t.name`, []));
  }
}
