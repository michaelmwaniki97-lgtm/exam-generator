"use client";

import {
  examStructureLabel,
  getSchoolAssessmentType,
  resolveAssessmentRules,
  type AssessmentContext,
  type ExamStructure,
  type SchoolAssessmentTypeId,
} from "@/lib/assessment/rules";
import type { WizardData } from "./types";
import { inputClass, labelClass, selectClass } from "@/components/ui/field-styles";

export function StepAssessment({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}) {
  const context: AssessmentContext = {
    educationSystem: data.educationSystem || "CBC",
    level: data.level,
    gradeName: data.gradeName,
    subjectName: data.subjectName,
  };
  const rules = resolveAssessmentRules(
    context,
    data.examType,
    data.examStructure
  );
  const selectedType = getSchoolAssessmentType(data.examType);
  const componentRule = rules.officialComponentRule;
  const verifiedComponents =
    componentRule?.verificationStatus === "VERIFIED"
      ? componentRule.components
      : [];
  const selectedComponent = verifiedComponents.find(
    (component) => component.id === data.componentId
  );
  const isKjseaPractice = data.examStructure === "kjsea_style";

  const selectAssessmentType = (value: string) => {
    const type = getSchoolAssessmentType(value);
    if (!type) {
      onChange({
        examType: "",
        examStructure: "standard",
        componentId: "",
        marks: null,
        duration: null,
      });
      return;
    }

    const nextRules = resolveAssessmentRules(context, type.id);
    const nextComponentRule = resolveAssessmentRules(
      context,
      type.id,
      nextRules.defaultExamStructure
    ).officialComponentRule;
    const soleComponent = nextComponentRule?.components.length === 1
      ? nextComponentRule.components[0]
      : null;
    onChange({
      examType: type.id as SchoolAssessmentTypeId,
      examStructure: nextRules.defaultExamStructure,
      componentId: soleComponent?.id ?? "",
      marks: soleComponent?.officialMarks ?? type.defaultMarks,
      duration: soleComponent?.durationMinutes ?? type.defaultDuration,
    });
  };

  const selectExamStructure = (value: string) => {
    const structure = value as ExamStructure;
    if (!rules.allowedExamStructures.includes(structure)) return;

    onChange({
      examStructure: structure,
      componentId: "",
      duration: selectedType?.defaultDuration ?? data.duration,
    });
  };

  const selectComponent = (componentId: string) => {
    const component = verifiedComponents.find(
      (candidate) => candidate.id === componentId
    );
    onChange({
      componentId: component?.id ?? "",
      marks: component?.officialMarks ?? data.marks,
      duration: component?.durationMinutes ?? data.duration,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Assessment type &amp; term
        </h2>
        <p className="mt-1 text-sm font-normal text-foreground/65">
          These are school/application formats. They are not described as universal
          KICD assessment categories.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="assessmentType" className={labelClass}>
            Assessment type <span className="text-accent">*</span>
          </label>
          <select
            id="assessmentType"
            className={selectClass}
            value={data.examType}
            onChange={(event) => selectAssessmentType(event.target.value)}
          >
            <option value="">Select an assessment type</option>
            {rules.allowedAssessmentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          {selectedType && (
            <p className="mt-1.5 text-xs text-foreground/55">
              {selectedType.description}
            </p>
          )}
        </div>

        {rules.allowedExamStructures.length > 1 && (
          <div>
            <label htmlFor="examStructure" className={labelClass}>
              Exam structure <span className="text-accent">*</span>
            </label>
            <select
              id="examStructure"
              className={selectClass}
              value={data.examStructure}
              onChange={(event) => selectExamStructure(event.target.value)}
            >
              {rules.allowedExamStructures.map((structure) => (
                <option key={structure} value={structure}>
                  {examStructureLabel(structure, data.examType)}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-foreground/55">
              KCSE-style uses a verified KCSE component identity and duration for
              school practice. Exact marks and paper structure remain unknown unless
              separately verified; this is not an official KNEC examination.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="term" className={labelClass}>
            Term <span className="text-accent">*</span>
          </label>
          <select
            id="term"
            className={selectClass}
            value={data.term}
            onChange={(event) =>
              onChange({ term: event.target.value as WizardData["term"] })
            }
          >
            <option value="">Select a term</option>
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </select>
          <p className="mt-1.5 text-xs text-foreground/55">
            Term records the school period; it does not determine curriculum coverage.
          </p>
        </div>

        <div>
          <label htmlFor="year" className={labelClass}>
            Year
          </label>
          <input
            id="year"
            type="number"
            className={inputClass}
            value={data.year ?? ""}
            onChange={(event) =>
              onChange({
                year: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
        </div>

        {(data.examStructure === "kcse_style" || data.examStructure === "kjsea_style") &&
          verifiedComponents.length > 1 && (
          <div>
            <label htmlFor="component" className={labelClass}>
              {isKjseaPractice ? "KJSEA" : "KCSE"}-style paper / component
              {componentRule?.componentSelectionRequired && (
                <span className="text-accent"> *</span>
              )}
            </label>
            <select
              id="component"
              className={selectClass}
              value={data.componentId}
              onChange={(event) => selectComponent(event.target.value)}
            >
              <option value="">Select a verified practice component</option>
              {verifiedComponents.map((component) => (
                <option key={component.id} value={component.id}>
                  {component.label} · {component.paperCode} ·{" "}
                  {component.durationMinutes} minutes
                </option>
              ))}
            </select>
            {selectedComponent && (
              <p className="mt-1.5 text-xs text-foreground/55">
                {selectedComponent.paperCode} · {selectedComponent.componentType} ·
                verified duration {selectedComponent.durationMinutes} minutes
              </p>
            )}
          </div>
        )}
      </div>

      {componentRule?.verificationStatus === "VERIFIED" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            {isKjseaPractice
              ? "Verified KJSEA practice profile"
              : "Verified KCSE component identity and duration"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
            {isKjseaPractice
              ? "This configures school-generated KJSEA-style practice material using a verified KJSEA profile. It is not issued or endorsed by KNEC."
              : data.gradeName === "Form 3"
              ? "Uses a verified KCSE component identity and duration for school practice. Exact marks, sections and question counts remain unknown. This is not an official Form 3 KNEC examination."
              : data.examType === "mock"
                ? "This configures a KCSE-style Form 4 Mock using a verified component identity and duration; exact marks, sections and question counts remain unknown. It is not an official KNEC examination."
                : "This configures a KCSE-style school End Term paper using a verified component identity and duration; exact marks, sections and question counts remain unknown. It is not administered by KNEC."}{" "}
            Source: {componentRule.source?.title} (
            {componentRule.source?.reference}).
          </p>
        </div>
      )}

      {componentRule?.verificationStatus === "SOURCE_REQUIRED" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            Official paper/component rule: source required
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            {componentRule.note} No official Paper 1, Paper 2, Paper 3, practical,
            oral, project, or SBA choice is being inferred.
          </p>
        </div>
      )}

      {selectedType && (
        <p className="text-xs text-foreground/55">
          {data.examStructure === "kcse_style"
            ? "Total marks remain teacher-configurable where the exact official total is unknown. The verified component duration is fixed."
            : data.examStructure === "kjsea_style"
              ? "Verified KJSEA component marks and duration are fixed for this school-generated practice paper."
            : "Marks and duration remain teacher-configurable for this school examination."}
        </p>
      )}
    </div>
  );
}
