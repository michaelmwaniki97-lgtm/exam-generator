import "server-only";

import type { PoolClient } from "pg";
import { queryRows, withAuthenticatedTransaction } from "../db/postgres-client.ts";
import type {
  AdminObjective,
  AdminOutcome,
  AdminStrand,
  AdminSubStrand,
  CurriculumNameRow,
  CurriculumReadRepository,
  OutcomeNameRow,
  ParentRow,
  SelectionObjective,
  SelectionOutcome,
  SelectionTopic,
  WizardStrand,
  WizardSubStrand,
  WizardSubjectContext,
} from "./contracts.ts";

function one<Row>(rows: Row[]): Row | null {
  if (rows.length > 1) throw new Error("Curriculum query returned an unexpected row count.");
  return rows[0] ?? null;
}

function groupBy<Row, Key extends string>(rows: Row[], key: (row: Row) => Key): Map<Key, Row[]> {
  const grouped = new Map<Key, Row[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
}

export class PostgresCurriculumReadRepository implements CurriculumReadRepository {
  private readonly userId: string;
  constructor(userId: string) { this.userId = userId; }

  private run<T>(work: (client: PoolClient) => Promise<T>) {
    return withAuthenticatedTransaction(this.userId, work);
  }

  listActiveGradeIds() {
    return this.run(async (client) => (await queryRows<{ grade_id: string }>(client,
      "select grade_id from public.strands where is_active = true order by sort_order, id", [])).map((row) => row.grade_id));
  }

  listSubjectContextsForGrade(gradeId: string) {
    return this.run((client) => queryRows<WizardSubjectContext>(client,
      `select st.grade_id, st.subject_id, st.is_active, st.verification_status,
              jsonb_build_object('id', su.id, 'name', su.name) as subject
         from public.strands st
         join public.subjects su on su.id = st.subject_id
        where st.grade_id = $1::uuid and st.is_active = true
        order by st.sort_order, st.id`, [gradeId]));
  }

  listActiveHierarchy(gradeId: string, subjectId: string) {
    return this.run(async (client) => {
      const strands = await queryRows<Omit<WizardStrand, "sub_strands">>(client,
        `select id, name, sort_order, source_code, source_ref, verification_status, is_active
           from public.strands
          where grade_id = $1::uuid and subject_id = $2::uuid and is_active = true
          order by sort_order, name, id`, [gradeId, subjectId]);
      if (strands.length === 0) return [];
      const children = await queryRows<WizardSubStrand & { strand_id: string }>(client,
        `select id, strand_id, name, sort_order, source_code, source_ref, verification_status
           from public.sub_strands where strand_id = any($1::uuid[])
          order by strand_id, sort_order, name, id`, [strands.map((row) => row.id)]);
      const byStrand = groupBy(children, (row) => row.strand_id);
      return strands.map((strand) => ({ ...strand, sub_strands: (byStrand.get(strand.id) ?? []).map((row) => ({
        id: row.id, name: row.name, sort_order: row.sort_order, source_code: row.source_code,
        source_ref: row.source_ref, verification_status: row.verification_status,
      })) }));
    });
  }

  getSelectionTopics(ids: readonly string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.run(async (client) => {
      type TopicBase = Omit<SelectionTopic, "strands" | "learning_outcomes"> & {
        strand_id: string;
        strand_name: string;
        strand_sort_order: number;
        subject_id: string;
        grade_id: string;
        is_active: boolean;
        strand_source_ref: string | null;
        strand_verification_status: SelectionTopic["verification_status"];
      };
      const topics = await queryRows<TopicBase>(client,
        `select ss.id, ss.name, ss.sort_order, ss.source_ref, ss.verification_status,
                st.id as strand_id, st.name as strand_name, st.sort_order as strand_sort_order,
                st.subject_id, st.grade_id, st.is_active, st.source_ref as strand_source_ref,
                st.verification_status as strand_verification_status
           from public.sub_strands ss
           join public.strands st on st.id = ss.strand_id
          where ss.id = any($1::uuid[])
          order by st.sort_order, ss.sort_order, ss.name, ss.id`, [[...ids]]);
      const strandIds = [...new Set(topics.map((row) => row.strand_id))];
      const outcomes = await queryRows<SelectionOutcome & { sub_strand_id: string }>(client,
        `select sub_strand_id, description, sort_order from public.learning_outcomes
          where sub_strand_id = any($1::uuid[]) order by sub_strand_id, sort_order, id`, [[...ids]]);
      const objectives = strandIds.length === 0 ? [] : await queryRows<SelectionObjective & { strand_id: string }>(client,
        `select strand_id, description, sort_order from public.strand_objectives
          where strand_id = any($1::uuid[]) order by strand_id, sort_order, id`, [strandIds]);
      const outcomesByTopic = groupBy(outcomes, (row) => row.sub_strand_id);
      const objectivesByStrand = groupBy(objectives, (row) => row.strand_id);
      return topics.map((topic) => ({
        id: topic.id, name: topic.name, sort_order: topic.sort_order,
        source_ref: topic.source_ref, verification_status: topic.verification_status,
        strands: {
          id: topic.strand_id, name: topic.strand_name, sort_order: topic.strand_sort_order,
          subject_id: topic.subject_id, grade_id: topic.grade_id, is_active: topic.is_active,
          source_ref: topic.strand_source_ref, verification_status: topic.strand_verification_status,
          strand_objectives: (objectivesByStrand.get(topic.strand_id) ?? []).map((row) => ({ description: row.description, sort_order: row.sort_order })),
        },
        learning_outcomes: (outcomesByTopic.get(topic.id) ?? []).map((row) => ({ description: row.description, sort_order: row.sort_order })),
      }));
    });
  }

  listAdminHierarchy(gradeId: string, subjectId: string) {
    return this.run(async (client) => {
      const strands = await queryRows<Omit<AdminStrand, "sub_strands" | "strand_objectives">>(client,
        `select id, name, sort_order, source_code, verification_status, outcome_status
           from public.strands
          where grade_id = $1::uuid and subject_id = $2::uuid and is_active = true
          order by sort_order, name, id`, [gradeId, subjectId]);
      if (strands.length === 0) return [];
      const strandIds = strands.map((row) => row.id);
      const subStrands = await queryRows<Omit<AdminSubStrand, "learning_outcomes"> & { strand_id: string }>(client,
        `select id, strand_id, name, sort_order, source_code, verification_status
           from public.sub_strands where strand_id = any($1::uuid[])
          order by strand_id, sort_order, name, id`, [strandIds]);
      const outcomes = subStrands.length === 0 ? [] : await queryRows<AdminOutcome & { sub_strand_id: string }>(client,
        `select id, sub_strand_id, description, sort_order, verification_status
           from public.learning_outcomes where sub_strand_id = any($1::uuid[])
          order by sub_strand_id, sort_order, description, id`, [subStrands.map((row) => row.id)]);
      const objectives = await queryRows<AdminObjective & { strand_id: string }>(client,
        `select id, strand_id, description, label, sort_order, verification_status
           from public.strand_objectives where strand_id = any($1::uuid[])
          order by strand_id, sort_order, description, id`, [strandIds]);
      const outcomesBySub = groupBy(outcomes, (row) => row.sub_strand_id);
      const subsByStrand = groupBy(subStrands, (row) => row.strand_id);
      const objectivesByStrand = groupBy(objectives, (row) => row.strand_id);
      return strands.map((strand) => ({
        ...strand,
        strand_objectives: (objectivesByStrand.get(strand.id) ?? []).map((row) => ({
          id: row.id, description: row.description, label: row.label, sort_order: row.sort_order, verification_status: row.verification_status,
        })),
        sub_strands: (subsByStrand.get(strand.id) ?? []).map((sub) => ({
          id: sub.id, name: sub.name, sort_order: sub.sort_order, source_code: sub.source_code, verification_status: sub.verification_status,
          learning_outcomes: (outcomesBySub.get(sub.id) ?? []).map((row) => ({
            id: row.id, description: row.description, sort_order: row.sort_order, verification_status: row.verification_status,
          })),
        })),
      }));
    });
  }

  private count(table: "strands" | "sub_strands" | "learning_outcomes", column: string, id: string) {
    const allowed = {
      strands: { subject_id: true, grade_id: true },
      sub_strands: { strand_id: true },
      learning_outcomes: { sub_strand_id: true },
    } as const;
    if (!(column in allowed[table])) throw new Error("Invalid curriculum count.");
    return this.run(async (client) => Number((await queryRows<{ count: string }>(client,
      `select count(*)::text as count from public.${table} where ${column} = $1::uuid`, [id]))[0]?.count ?? 0));
  }

  countStrandsBySubject(id: string) { return this.count("strands", "subject_id", id); }
  countStrandsByGrade(id: string) { return this.count("strands", "grade_id", id); }
  countSubStrands(id: string) { return this.count("sub_strands", "strand_id", id); }
  countLearningOutcomes(id: string) { return this.count("learning_outcomes", "sub_strand_id", id); }

  listStrandNames(gradeId: string, subjectId: string) {
    return this.run((client) => queryRows<CurriculumNameRow>(client,
      "select id, name from public.strands where grade_id = $1::uuid and subject_id = $2::uuid order by id", [gradeId, subjectId]));
  }
  getStrandParent(id: string) {
    return this.run(async (client) => one(await queryRows<{ id: string; grade_id: string; subject_id: string }>(client,
      "select id, grade_id, subject_id from public.strands where id = $1::uuid", [id])));
  }
  listSubStrandNames(strandId: string) {
    return this.run((client) => queryRows<CurriculumNameRow>(client,
      "select id, name from public.sub_strands where strand_id = $1::uuid order by id", [strandId]));
  }
  getSubStrandParent(id: string) {
    return this.run(async (client) => one(await queryRows<ParentRow>(client,
      "select id, strand_id as parent_id from public.sub_strands where id = $1::uuid", [id])));
  }
  listLearningOutcomeDescriptions(subStrandId: string) {
    return this.run((client) => queryRows<OutcomeNameRow>(client,
      "select id, description from public.learning_outcomes where sub_strand_id = $1::uuid order by id", [subStrandId]));
  }
  getLearningOutcomeParent(id: string) {
    return this.run(async (client) => one(await queryRows<ParentRow>(client,
      "select id, sub_strand_id as parent_id from public.learning_outcomes where id = $1::uuid", [id])));
  }
}
