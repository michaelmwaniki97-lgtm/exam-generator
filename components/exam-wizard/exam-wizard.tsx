"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { generateExam } from "@/app/actions/exams";
import { listWizardGrades } from "@/app/actions/catalog";
import {
  listActiveCurriculum,
  listActiveCurriculumGradeIds,
  listCurriculumSubjects,
} from "@/app/actions/curriculum";
import { listReadyTextbooks } from "@/app/actions/database-rpc";
import {
  inferEducationSystem,
  isSupportedNewExamGrade,
  resolveAssessmentRules,
  type AssessmentContext,
} from "@/lib/assessment/rules";
import { validateAssessmentSelection } from "@/lib/assessment/validation";
import {
  deriveAvailableSubjects,
  orderActiveCurriculum,
  type CurriculumStrandRow,
  type SubjectContextRow,
} from "@/lib/curriculum/exam-selection";
import { ProgressBar } from "./progress-bar";
import { StepClassDetails } from "./step-class-details";
import { StepSubject } from "./step-subject";
import { StepAssessment } from "./step-assessment";
import { StepTopics } from "./step-topics";
import { StepSettings } from "./step-settings";
import { StepReview } from "./step-review";
import { canProceedWizardStep, transitionWizardData } from "./state";
import {
  EMPTY_WIZARD_DATA,
  STEP_LABELS,
  type Grade,
  type Strand,
  type Subject,
  type Textbook,
  type WizardData,
} from "./types";

function assessmentContext(data: WizardData): AssessmentContext | null {
  if (
    !data.educationSystem ||
    !data.level ||
    !data.gradeName ||
    !data.subjectName
  ) {
    return null;
  }
  return {
    educationSystem: data.educationSystem,
    level: data.level,
    gradeName: data.gradeName,
    subjectName: data.subjectName,
  };
}

function canProceed(step: number, data: WizardData): boolean {
  if (!canProceedWizardStep(step, data)) return false;
  if (step !== 4) return true;

  const context = assessmentContext(data);
  if (!context) return false;
  const rules = resolveAssessmentRules(
    context,
    data.examType,
    data.examStructure
  );
  return (
    validateAssessmentSelection({
      assessmentTypeId: data.examType,
      examStructureId: data.examStructure,
      componentId: data.componentId,
      allowedAssessmentTypeIds: rules.allowedAssessmentTypes.map((type) => type.id),
      componentRule: rules.officialComponentRule,
      allowedExamStructureIds: rules.allowedExamStructures,
    }) === null
  );
}

export function ExamWizard() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD_DATA);
  const [generating, startGenerating] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generationRequestId = useRef(crypto.randomUUID());

  const [grades, setGrades] = useState<Grade[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(true);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [loadingTextbooks, setLoadingTextbooks] = useState(false);

  const [strands, setStrands] = useState<Strand[]>([]);
  const [loadingStrands, setLoadingStrands] = useState(false);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);

  const onChange = (patch: Partial<WizardData>) => {
    setGenerateError(null);

    const gradeContextChanged =
      "educationSystem" in patch || "level" in patch || "gradeId" in patch;
    if (gradeContextChanged) {
      setSubjects([]);
      setSubjectError(null);
      setLoadingSubjects("gradeId" in patch && Boolean(patch.gradeId));
      setTextbooks([]);
      setStrands([]);
      setCurriculumError(null);
      setLoadingTextbooks(false);
      setLoadingStrands(false);
    }

    if ("subjectId" in patch) {
      const hasResourceContext = Boolean(patch.subjectId && data.gradeId);
      setTextbooks([]);
      setStrands([]);
      setCurriculumError(null);
      setLoadingTextbooks(hasResourceContext);
      setLoadingStrands(hasResourceContext);
    }

    setData((previous) => {
      const tentative = { ...previous, ...patch };
      const context = assessmentContext(tentative);
      const rules = context
        ? resolveAssessmentRules(
            context,
            tentative.examType,
            tentative.examStructure
          )
        : null;

      return transitionWizardData(previous, patch, {
        allowedAssessmentTypeIds:
          rules?.allowedAssessmentTypes.map((type) => type.id) ?? [],
        allowedExamStructureIds:
          rules?.allowedExamStructures ?? ["standard"],
      });
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function loadGrades() {
      setLoadingGrades(true);
      setGradeError(null);
      const activeRootsResult = await listActiveCurriculumGradeIds();
      if (activeRootsResult.error) {
        if (!cancelled) {
          setGrades([]);
          setGradeError("Could not load active curriculum contexts.");
          setLoadingGrades(false);
        }
        return;
      }

      const gradesResult = await listWizardGrades();
      if (cancelled) return;
      if (gradesResult.error || !gradesResult.data) {
        setGrades([]);
        setGradeError("Could not load supported Grades and Forms.");
        setLoadingGrades(false);
        return;
      }

      const activeGradeIds = new Set(
        activeRootsResult.data ?? []
      );
      const available = (gradesResult.data ?? [])
        .map((grade) => ({
          ...grade,
          sort_order: grade.sort_order ?? 0,
        }))
        .filter(
          (grade) =>
            activeGradeIds.has(grade.id) &&
            isSupportedNewExamGrade(grade.name, grade.level) &&
            inferEducationSystem(grade.name)
        );

      setGrades(available);
      setLoadingGrades(false);
    }

    void loadGrades();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!data.gradeId) {
      return () => {
        cancelled = true;
      };
    }

    void listCurriculumSubjects(data.gradeId)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setSubjectError("Could not load subjects with active curriculum.");
          setLoadingSubjects(false);
          return;
        }

        const rows: SubjectContextRow[] = (result.data ?? []).map((row) => ({
          grade_id: row.grade_id,
          subject_id: row.subject_id,
          is_active: row.is_active,
          verification_status: row.verification_status,
          subject: row.subject,
        }));
        const available = deriveAvailableSubjects(rows, data.gradeId);
        setSubjects(available);
        setData((previous) => {
          if (
            !previous.subjectId ||
            available.some((subject) => subject.id === previous.subjectId)
          ) {
            return previous;
          }
          return transitionWizardData(previous, {
            subjectId: "",
            subjectName: "",
          });
        });
        setLoadingSubjects(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data.gradeId]);

  useEffect(() => {
    let cancelled = false;

    if (!data.subjectId || !data.gradeId) {
      return () => {
        cancelled = true;
      };
    }

    void listReadyTextbooks(data.subjectId, data.gradeId)
      .then((rows) => {
        if (cancelled) return;
        const available = rows as Textbook[];
        setTextbooks(available);
        setData((previous) => {
          if (
            !previous.textbookId ||
            available.some((textbook) => textbook.id === previous.textbookId)
          ) {
            return previous;
          }
          return {
            ...previous,
            textbookId: "",
            textbookName: "",
          };
        });
        setLoadingTextbooks(false);
      })
      .catch(() => {
        if (!cancelled) {
          setTextbooks([]);
          setData((previous) => ({
            ...previous,
            textbookId: "",
            textbookName: "",
          }));
          setLoadingTextbooks(false);
        }
      });

    void listActiveCurriculum(data.gradeId, data.subjectId)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setCurriculumError(
            "Could not load the active curriculum for this class and subject."
          );
          setLoadingStrands(false);
          return;
        }

        const available = orderActiveCurriculum(
          (result.data ?? []) as unknown as CurriculumStrandRow[]
        );
        const validIds = new Set(
          available.flatMap((strand) =>
            strand.sub_strands.map((subStrand) => subStrand.id)
          )
        );
        setStrands(available);
        setData((previous) => ({
          ...previous,
          topicIds: previous.topicIds.filter((id) => validIds.has(id)),
        }));
        setLoadingStrands(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data.subjectId, data.gradeId]);

  const loadError =
    step === 1
      ? gradeError
      : step === 2
        ? subjectError
        : step === 3
          ? curriculumError
          : null;
  const hasMappedCurriculum = strands.some(
    (strand) => strand.sub_strands.length > 0
  );

  const goNext = () =>
    setStep((current) => Math.min(current + 1, STEP_LABELS.length));
  const goBack = () => setStep((current) => Math.max(current - 1, 1));

  const handleGenerate = () => {
    setGenerateError(null);
    startGenerating(async () => {
      try {
        const result = await generateExam(data, generationRequestId.current);
        if (result?.error) {
          if (!result.preserveRequest) generationRequestId.current = crypto.randomUUID();
          setGenerateError(result.error);
        }
      } catch {
        setGenerateError(
          "The generation request was interrupted before it completed. Please try again."
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar currentStep={step} />

      <div className="rounded-xl border border-border bg-card p-5 sm:p-7">
        {loadError && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {loadError}
          </p>
        )}

        {step === 1 && (
          <StepClassDetails
            data={data}
            onChange={onChange}
            grades={grades}
            loading={loadingGrades}
          />
        )}
        {step === 2 && (
          <StepSubject
            data={data}
            onChange={onChange}
            subjects={subjects}
            textbooks={textbooks}
            loadingSubjects={loadingSubjects}
            loadingTextbooks={loadingTextbooks}
          />
        )}
        {step === 3 && (
          <StepTopics
            data={data}
            onChange={onChange}
            strands={strands}
            loading={loadingStrands}
          />
        )}
        {step === 4 && <StepAssessment data={data} onChange={onChange} />}
        {step === 5 && <StepSettings data={data} onChange={onChange} />}
        {step === 6 && <StepReview data={data} strands={strands} />}
      </div>

      {generating && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3"
        >
          <p className="text-sm font-semibold text-foreground">Preparing your exam</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/65">
            Creating the paper and marking scheme from your saved selections. Keep
            this page open.
          </p>
        </div>
      )}

      {generateError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-red-800">Generation interrupted</p>
          <p className="mt-1 text-sm text-red-700">{generateError}</p>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || generating}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Back
        </button>

        {step < STEP_LABELS.length ? (
          <button
            type="button"
            onClick={goNext}
            disabled={
              step === 2
                ? !data.subjectId || loadingStrands || !hasMappedCurriculum
                : !canProceed(step, data) || Boolean(loadError)
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none"
          >
            Continue
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100 motion-reduce:transform-none"
          >
            {generating ? (
              <>
                <Loader2
                  size={16}
                  strokeWidth={2}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
                {generateError ? "Try generating again" : "Generate exam"}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
