"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateExam } from "@/app/actions/exams";
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
  if (step !== 3) return true;

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
      const supabase = createClient();

      const activeRootsResult = await supabase
        .from("strands")
        .select("grade_id")
        .eq("is_active", true);
      if (activeRootsResult.error) {
        if (!cancelled) {
          setGrades([]);
          setGradeError("Could not load active curriculum contexts.");
          setLoadingGrades(false);
        }
        return;
      }

      const gradesResult = await supabase
        .from("grades")
        .select("id, name, level, sort_order")
        .order("sort_order")
        .order("created_at");
      if (cancelled) return;
      if (gradesResult.error) {
        setGrades([]);
        setGradeError("Could not load supported Grades and Forms.");
        setLoadingGrades(false);
        return;
      }

      const activeGradeIds = new Set(
        (activeRootsResult.data ?? []).map((row) => row.grade_id)
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

    const supabase = createClient();
    void supabase
      .from("strands")
      .select(
        "grade_id, subject_id, is_active, verification_status, subjects(id, name)"
      )
      .eq("grade_id", data.gradeId)
      .eq("is_active", true)
      .order("sort_order")
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
          subject: row.subjects as unknown as { id: string; name: string } | null,
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

    const supabase = createClient();
    void supabase
      .rpc("list_ready_textbooks", { p_subject_id: data.subjectId, p_grade_id: data.gradeId })
      .then((result) => {
        if (result.error) setSubjectError("Could not load processed textbooks.");
        if (cancelled) return;
        const available = (result.data ?? []) as Textbook[];
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
      });

    void supabase
      .from("strands")
      .select(
        "id, name, sort_order, source_code, source_ref, verification_status, is_active, sub_strands(id, name, sort_order, source_code, source_ref, verification_status)"
      )
      .eq("subject_id", data.subjectId)
      .eq("grade_id", data.gradeId)
      .eq("is_active", true)
      .order("sort_order")
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
        : step === 4
          ? curriculumError
          : null;

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
    <div className="flex flex-col gap-8">
      <ProgressBar currentStep={step} />

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
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
        {step === 3 && <StepAssessment data={data} onChange={onChange} />}
        {step === 4 && (
          <StepTopics
            data={data}
            onChange={onChange}
            strands={strands}
            loading={loadingStrands}
          />
        )}
        {step === 5 && <StepSettings data={data} onChange={onChange} />}
        {step === 6 && <StepReview data={data} strands={strands} />}
      </div>

      {generateError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {generateError}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
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
            disabled={!canProceed(step, data) || Boolean(loadError)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none"
          >
            Next
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
                Generate draft exam
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
