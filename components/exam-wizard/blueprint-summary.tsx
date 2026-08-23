import { AlertTriangle, CheckCircle2, ListChecks } from "lucide-react";
import {
  getSchoolAssessmentType,
  resolveAssessmentRules,
  type AssessmentContext,
} from "@/lib/assessment/rules";
import { resolveAssessmentProfile } from "@/lib/assessment/profiles";
import { buildExamBlueprint } from "@/lib/blueprint/engine";
import type { ExamBlueprint } from "@/lib/blueprint/types";
import type { Strand, WizardData } from "./types";

function timeFitLabel(blueprint: ExamBlueprint): string {
  if (blueprint.timeFit.status === "WARNING_TIME_PRESSURE") {
    return "Time pressure — review workload";
  }
  if (blueprint.timeFit.status === "WARNING_TOO_LIGHT") {
    return "Light for selected duration";
  }
  return "Fits selected duration";
}

function buildPreview(
  data: WizardData,
  strands: Strand[]
): ExamBlueprint | null {
  if (
    !data.educationSystem ||
    !data.level ||
    !data.gradeId ||
    !data.gradeName ||
    !data.subjectId ||
    !data.subjectName ||
    !data.examType ||
    !data.difficulty ||
    !data.marks ||
    !data.duration
  ) {
    return null;
  }

  const assessmentType = getSchoolAssessmentType(data.examType);
  if (!assessmentType) return null;
  const context: AssessmentContext = {
    educationSystem: data.educationSystem,
    level: data.level,
    gradeName: data.gradeName,
    subjectName: data.subjectName,
  };
  const rules = resolveAssessmentRules(
    context,
    data.examType,
    data.examStructure
  );
  const componentRule = rules.officialComponentRule;
  const component =
    componentRule?.verificationStatus === "VERIFIED"
      ? componentRule.components.find(
          (candidate) => candidate.id === data.componentId
        ) ?? null
      : null;
  const curriculum = strands.flatMap((strand) =>
    strand.sub_strands
      .filter((subStrand) => data.topicIds.includes(subStrand.id))
      .map((subStrand) => ({
        curriculumId: subStrand.id,
        parentId: strand.id,
        parentName: strand.name,
        name: subStrand.name,
        parentSortOrder: strand.sort_order,
        sortOrder: subStrand.sort_order,
        gradeId: data.gradeId,
        subjectId: data.subjectId,
        isActive: true,
        verificationStatus: subStrand.verification_status,
        sourceRef: subStrand.source_ref,
        outcomesAvailable: false,
      }))
  );

  try {
    const assessmentProfile = resolveAssessmentProfile({
      educationSystem: data.educationSystem,
      level: data.level,
      gradeName: data.gradeName,
      subjectName: data.subjectName,
      assessmentType: assessmentType.id,
      examStructure: data.examStructure,
      component,
      requestedMarks: data.marks,
      requestedDurationMinutes: data.duration,
    });
    return buildExamBlueprint({
      educationSystem: data.educationSystem,
      educationLevel: data.level,
      gradeId: data.gradeId,
      gradeName: data.gradeName,
      subjectId: data.subjectId,
      subjectName: data.subjectName,
      assessmentType,
      examStructure: data.examStructure,
      allowedExamStructures: rules.allowedExamStructures,
      component,
      allowedComponentIds:
        componentRule?.verificationStatus === "VERIFIED"
          ? componentRule.components.map((candidate) => candidate.id)
          : [],
      assessmentProfile,
      totalMarks: data.marks,
      durationMinutes: data.duration,
      difficulty: data.difficulty,
      curriculum,
    });
  } catch {
    return null;
  }
}

export function BlueprintSummary({
  data,
  strands,
}: {
  data: WizardData;
  strands: Strand[];
}) {
  const blueprint = buildPreview(data, strands);
  if (!blueprint) return null;

  return (
    <section
      aria-labelledby="blueprint-summary-heading"
      className="rounded-lg border border-accent/25 bg-accent/5 p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            Application-planned exam
          </p>
          <h3
            id="blueprint-summary-heading"
            className="mt-1 text-base font-semibold text-foreground"
          >
            Blueprint summary
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-foreground/60">
            Mark splits, question groups, cognitive targets and timing are
            application estimates, not official KNEC specifications.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">
          {blueprint.timeFit.status === "OK" ? (
            <CheckCircle2 size={14} aria-hidden="true" />
          ) : (
            <AlertTriangle size={14} aria-hidden="true" />
          )}
          {timeFitLabel(blueprint)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-foreground/60">Planned groups</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {blueprint.sections.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-foreground/60">Question slots</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {blueprint.questionSlots.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-foreground/60">Curriculum coverage</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {blueprint.curriculumScope.selectedCount} selected across{" "}
            {blueprint.curriculumScope.parentCount} parent areas
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-foreground/60">Estimated completion</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {blueprint.estimatedCompletionMinutes} min
          </p>
          <p className="text-xs text-foreground/50">
            Selected: {blueprint.durationMinutes} min
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Marks by group
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {blueprint.sections.map((section) => (
              <div
                key={section.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-foreground/75">{section.label}</span>
                <span className="font-semibold text-foreground">
                  {section.targetMarks} marks
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Cognitive target
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {blueprint.cognitiveProfile.targets.map((target) => (
              <span
                key={target.demand}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/75"
              >
                {target.demand.toLowerCase()}: {target.targetPercent}%
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-foreground/60">
            Broad question types
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/75">
            {blueprint.questionTypeTargets
              .map((target) => target.label)
              .join(", ")}
          </p>
        </div>
      </div>

      {blueprint.validation.warnings.length > 0 && (
        <div
          role="status"
          className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle size={16} aria-hidden="true" />
            Review notes
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
            {blueprint.validation.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-5 rounded-lg border border-border bg-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          <ListChecks size={17} aria-hidden="true" />
          View exam plan
        </summary>
        <div className="border-t border-border px-4 py-4">
          <div className="flex flex-col gap-5">
            {blueprint.sections.map((section) => (
              <div key={section.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {section.label}
                  </p>
                  <p className="text-xs text-foreground/60">
                    {section.targetMarks} marks · about{" "}
                    {section.estimatedMinutes} minutes
                  </p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-foreground/60">
                  {section.purpose}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {blueprint.questionSlots
                    .filter((slot) => slot.sectionId === section.id)
                    .map((slot) => {
                      const curriculumNames = slot.curriculumTargetIds
                        .map(
                          (id) =>
                            blueprint.topicAllocations.find(
                              (allocation) => allocation.curriculumId === id
                            )?.displayName
                        )
                        .filter(Boolean)
                        .join(", ");
                      return (
                        <div
                          key={slot.id}
                          className="grid gap-1 rounded-lg bg-foreground/[0.03] px-3 py-2 text-xs sm:grid-cols-[1fr_auto] sm:items-center"
                        >
                          <span className="text-foreground/75">
                            {slot.questionFamilyLabel} · {curriculumNames}
                          </span>
                          <span className="font-semibold text-foreground">
                            {slot.targetMarks} marks ·{" "}
                            {slot.cognitiveDemand.toLowerCase()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Curriculum allocation
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {blueprint.topicAllocations.map((allocation) => (
                <div
                  key={allocation.curriculumId}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span className="text-foreground/70">
                    {allocation.parentName} · {allocation.displayName}
                  </span>
                  <span className="shrink-0 font-semibold text-foreground">
                    {allocation.targetMarks} marks
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
