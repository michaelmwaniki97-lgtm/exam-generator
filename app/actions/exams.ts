"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateExam as callAi, type TopicInput } from "@/lib/ai/generate-exam";
import {
  APPLICATION_EXAM_LIMITS,
  examStructureLabel,
  getSchoolAssessmentType,
  inferEducationSystem,
  isSupportedNewExamGrade,
  resolveAssessmentRules,
  type AssessmentContext,
  type OfficialComponent,
} from "@/lib/assessment/rules";
import {
  validateAssessmentSelection,
  validateBasicExamInput,
} from "@/lib/assessment/validation";
import {
  BlueprintBuildError,
  buildExamBlueprint,
} from "@/lib/blueprint/engine";
import type { BlueprintCurriculumNode } from "@/lib/blueprint/types";
import {
  buildCurriculumSelectionSnapshot,
  validateNewExamCurriculumSelection,
  type CurriculumSelectionSnapshot,
  type CurriculumVerificationStatus,
  type SelectedCurriculumRow,
} from "@/lib/curriculum/exam-selection";
import type { WizardData } from "@/components/exam-wizard/types";

export type GenerateExamState = { error: string } | undefined;

type TopicRow = {
  id: string;
  name: string;
  sort_order: number;
  source_ref: string | null;
  verification_status: CurriculumVerificationStatus;
  strands: {
    id: string;
    name: string;
    sort_order: number;
    subject_id: string;
    grade_id: string;
    is_active: boolean;
    source_ref: string | null;
    verification_status: CurriculumVerificationStatus;
    strand_objectives: Array<{ description: string; sort_order: number }>;
  } | null;
  learning_outcomes: Array<{ description: string; sort_order: number }>;
};

function toSelectionRows(rows: readonly TopicRow[]): SelectedCurriculumRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sort_order: row.sort_order,
    source_ref: row.source_ref,
    verification_status: row.verification_status,
    strand: row.strands
      ? {
          id: row.strands.id,
          name: row.strands.name,
          sort_order: row.strands.sort_order,
          grade_id: row.strands.grade_id,
          subject_id: row.strands.subject_id,
          is_active: row.strands.is_active,
          source_ref: row.strands.source_ref,
          verification_status: row.strands.verification_status,
        }
      : null,
  }));
}

function toTopicInputs(
  snapshot: readonly CurriculumSelectionSnapshot[],
  rows: readonly TopicRow[]
): TopicInput[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));

  return snapshot.flatMap((strand) =>
    strand.subStrands.map((subStrand) => {
      const row = rowById.get(subStrand.id)!;
      const topicObjectives = [...(row.strands?.strand_objectives ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order
      );
      const outcomes = [...row.learning_outcomes].sort(
        (a, b) => a.sort_order - b.sort_order
      );

      return {
        strandName: strand.strandName,
        subStrandName: subStrand.name,
        outcomes: topicObjectives.length
          ? topicObjectives.map((objective) => objective.description)
          : outcomes.map((outcome) => outcome.description),
        outcomeScope: topicObjectives.length ? "strand" : "sub_strand",
      };
    })
  );
}

function toBlueprintCurriculum(
  rows: readonly TopicRow[],
  educationSystem: "CBC" | "8-4-4"
): BlueprintCurriculumNode[] {
  return rows.map((row) => {
    const parent = row.strands!;
    const outcomesAvailable =
      educationSystem === "CBC"
        ? row.learning_outcomes.length > 0
        : parent.strand_objectives.length > 0 ||
          row.learning_outcomes.length > 0;

    return {
      curriculumId: row.id,
      parentId: parent.id,
      parentName: parent.name,
      name: row.name,
      parentSortOrder: parent.sort_order,
      sortOrder: row.sort_order,
      gradeId: parent.grade_id,
      subjectId: parent.subject_id,
      isActive: parent.is_active,
      verificationStatus: row.verification_status,
      sourceRef: row.source_ref,
      outcomesAvailable,
    };
  });
}

export async function generateExam(data: WizardData): Promise<GenerateExamState> {
  const validationError = validateBasicExamInput(data, APPLICATION_EXAM_LIMITS);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to generate an exam." };

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!teacher) return { error: "Only teachers can generate exams." };

  const gradeResult = await supabase
    .from("grades")
    .select("id, name, level")
    .eq("id", data.gradeId)
    .maybeSingle();
  if (gradeResult.error || !gradeResult.data) {
    return { error: "The selected Grade or Form does not exist." };
  }
  const grade = gradeResult.data;
  const educationSystem = inferEducationSystem(grade.name);
  if (
    !educationSystem ||
    !isSupportedNewExamGrade(grade.name, grade.level) ||
    educationSystem !== data.educationSystem ||
    grade.level !== data.level
  ) {
    return { error: "The selected education system, level, and Grade/Form do not match." };
  }

  const subjectResult = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", data.subjectId)
    .maybeSingle();
  if (subjectResult.error || !subjectResult.data) {
    return { error: "The selected subject does not exist." };
  }
  const subject = subjectResult.data;

  const context: AssessmentContext = {
    educationSystem,
    level: grade.level,
    gradeName: grade.name,
    subjectName: subject.name,
  };
  const assessmentRules = resolveAssessmentRules(
    context,
    data.examType,
    data.examStructure
  );
  const assessmentError = validateAssessmentSelection({
    assessmentTypeId: data.examType,
    examStructureId: data.examStructure,
    componentId: data.componentId,
    allowedAssessmentTypeIds: assessmentRules.allowedAssessmentTypes.map(
      (type) => type.id
    ),
    allowedExamStructureIds: assessmentRules.allowedExamStructures,
    componentRule: assessmentRules.officialComponentRule,
  });
  if (assessmentError) return { error: assessmentError };

  const assessmentType = getSchoolAssessmentType(data.examType);
  if (!assessmentType) {
    return { error: "The selected assessment type is invalid." };
  }

  const componentRule = assessmentRules.officialComponentRule;
  let component: OfficialComponent | null = null;
  if (componentRule?.verificationStatus === "VERIFIED") {
    component =
      componentRule.components.find(
        (candidate) => candidate.id === data.componentId
      ) ??
      (componentRule.components.length === 1 &&
      !componentRule.componentSelectionRequired
        ? componentRule.components[0]
        : null);
  }

  const topicsResult = await supabase
    .from("sub_strands")
    .select(
      "id, name, sort_order, source_ref, verification_status, strands(id, name, sort_order, subject_id, grade_id, is_active, source_ref, verification_status, strand_objectives(description, sort_order)), learning_outcomes(description, sort_order)"
    )
    .in("id", data.topicIds);
  if (
    topicsResult.error ||
    !topicsResult.data ||
    topicsResult.data.length !== data.topicIds.length
  ) {
    return {
      error: "Could not load every selected curriculum record. Please review the selection.",
    };
  }

  const rows = topicsResult.data as unknown as TopicRow[];
  const selectionRows = toSelectionRows(rows);
  const curriculumError = validateNewExamCurriculumSelection({
    gradeId: grade.id,
    subjectId: subject.id,
    selectedIds: data.topicIds,
    rows: selectionRows,
  });
  if (curriculumError) return { error: curriculumError };

  const curriculumSelection = buildCurriculumSelectionSnapshot(selectionRows);
  if (curriculumSelection.length === 0) {
    return { error: "Please select at least one active curriculum area." };
  }

  let blueprint;
  try {
    blueprint = buildExamBlueprint({
      educationSystem,
      educationLevel: grade.level,
      gradeId: grade.id,
      gradeName: grade.name,
      subjectId: subject.id,
      subjectName: subject.name,
      assessmentType,
      examStructure: data.examStructure,
      allowedExamStructures: assessmentRules.allowedExamStructures,
      component,
      allowedComponentIds:
        componentRule?.verificationStatus === "VERIFIED"
          ? componentRule.components.map((candidate) => candidate.id)
          : [],
      totalMarks: data.marks!,
      durationMinutes: data.duration!,
      difficulty: data.difficulty as "easy" | "medium" | "hard",
      curriculum: toBlueprintCurriculum(rows, educationSystem),
    });
  } catch (error) {
    return {
      error:
        error instanceof BlueprintBuildError
          ? error.message
          : "Could not build a valid exam plan. Please review the configuration.",
    };
  }

  let textbookName: string | undefined;
  if (data.textbookId) {
    const textbookResult = await supabase
      .from("textbooks")
      .select("id, name")
      .eq("id", data.textbookId)
      .eq("subject_id", subject.id)
      .eq("grade_id", grade.id)
      .maybeSingle();
    if (textbookResult.error || !textbookResult.data) {
      return { error: "The selected textbook does not match the class and subject." };
    }
    textbookName = textbookResult.data.name;
  }

  let persistenceClient: ReturnType<typeof createAdminClient>;
  try {
    persistenceClient = createAdminClient();
  } catch {
    return {
      error: "Exam generation is temporarily unavailable. Please contact an administrator.",
    };
  }

  const topics = toTopicInputs(curriculumSelection, rows);
  let generated;
  try {
    generated = await callAi({
      subjectName: subject.name,
      gradeName: grade.name,
      level: grade.level,
      examType: assessmentType.label,
      difficulty: data.difficulty as "easy" | "medium" | "hard",
      marks: data.marks!,
      duration: data.duration!,
      topics,
      textbookName,
      blueprint,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Exam generation failed. Please try again.",
    };
  }

  const { data: examRow, error: insertError } = await persistenceClient
    .from("exams")
    .insert({
      teacher_id: teacher.id,
      subject_id: subject.id,
      grade_id: grade.id,
      exam_type: assessmentType.label,
      marks: data.marks,
      duration: data.duration,
      difficulty: data.difficulty,
      term: data.term,
      year: data.year,
      status: "generated",
      content: {
        instructions: generated.instructions,
        sections: generated.sections,
        meta: {
          educationSystem,
          level: grade.level,
          subjectName: subject.name,
          gradeName: grade.name,
          textbookName: textbookName ?? null,
          topicIds: data.topicIds,
          assessmentType: {
            id: assessmentType.id,
            label: assessmentType.label,
            category: "school_application",
          },
          examStructure: {
            id: data.examStructure,
            label: examStructureLabel(data.examStructure, assessmentType.id),
          },
          paperComponent: component
            ? {
                id: component.id,
                paperNumber: component.paperNumber,
                paperCode: component.paperCode,
                label: component.label,
                officialLabel: component.officialLabel,
                componentType: component.componentType,
                verifiedDurationMinutes: component.durationMinutes,
                configuredDurationMinutes: data.duration,
                officialMarks: component.officialMarks,
                verificationStatus: component.verificationStatus,
                source: component.source,
              }
            : null,
          componentRule: componentRule
            ? {
                id: componentRule.id,
                subjectCode: componentRule.subjectCode,
                officialSubjectName: componentRule.officialSubjectName,
                verificationStatus: componentRule.verificationStatus,
                source: componentRule.source,
              }
            : null,
          curriculumSelection,
          curriculumPolicy: "new_exam_active_roots_only",
          blueprint,
          teacherReviewRequired: true,
        },
      },
    })
    .select("id")
    .single();

  if (insertError || !examRow) {
    return { error: "Could not save the generated exam. Please try again." };
  }

  const { error: markingError } = await persistenceClient
    .from("marking_schemes")
    .insert({ exam_id: examRow.id, content: { entries: generated.marking_scheme } });

  if (markingError) {
    await persistenceClient.from("exams").delete().eq("id", examRow.id);
    return { error: "Could not save the marking scheme. Please try again." };
  }

  redirect(`/teacher/exams/${examRow.id}`);
}
