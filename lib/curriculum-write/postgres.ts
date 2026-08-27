import "server-only";

import { queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type { CurriculumWriteRepository } from "./contracts.ts";

type IdRow = { id: string };

export class PostgresCurriculumWriteRepository implements CurriculumWriteRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  async createStrand(gradeId: string, subjectId: string, name: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) => client.query(
      "insert into public.strands (grade_id, subject_id, name) values ($1::uuid, $2::uuid, $3::text)",
      [gradeId, subjectId, name]
    ));
  }

  async updateStrand(id: string, name: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) => client.query(
      `update public.strands
       set name = $2::text, source_code = null, verification_status = 'unverified',
           outcome_status = 'unverified', source_ref = null, source_metadata = '{}'::jsonb
       where id = $1::uuid`,
      [id, name]
    ));
  }

  async deleteStrand(id: string): Promise<boolean> {
    return withAuthenticatedTransaction(this.userId, async (client) =>
      (await queryRows<IdRow>(client,
        "delete from public.strands where id = $1::uuid returning id", [id])).length > 0);
  }

  async createSubStrand(strandId: string, name: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) => client.query(
      "insert into public.sub_strands (strand_id, name) values ($1::uuid, $2::text)",
      [strandId, name]
    ));
  }

  async updateSubStrand(id: string, name: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) => client.query(
      `update public.sub_strands
       set name = $2::text, source_code = null, verification_status = 'unverified',
           outcome_status = 'unverified', source_ref = null, source_metadata = '{}'::jsonb
       where id = $1::uuid`,
      [id, name]
    ));
  }

  async deleteSubStrand(id: string): Promise<boolean> {
    return withAuthenticatedTransaction(this.userId, async (client) =>
      (await queryRows<IdRow>(client,
        "delete from public.sub_strands where id = $1::uuid returning id", [id])).length > 0);
  }

  async createLearningOutcome(subStrandId: string, description: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) => client.query(
      "insert into public.learning_outcomes (sub_strand_id, description) values ($1::uuid, $2::text)",
      [subStrandId, description]
    ));
  }

  async updateLearningOutcome(id: string, description: string): Promise<void> {
    await withAuthenticatedTransaction(this.userId, (client) => client.query(
      `update public.learning_outcomes
       set description = $2::text, verification_status = 'unverified',
           source_ref = null, source_metadata = '{}'::jsonb
       where id = $1::uuid`,
      [id, description]
    ));
  }

  async deleteLearningOutcome(id: string): Promise<boolean> {
    return withAuthenticatedTransaction(this.userId, async (client) =>
      (await queryRows<IdRow>(client,
        "delete from public.learning_outcomes where id = $1::uuid returning id", [id])).length > 0);
  }
}
