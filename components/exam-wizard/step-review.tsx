import {
  educationSystemLabel,
  examStructureLabel,
  getSchoolAssessmentType,
  resolveAssessmentRules,
  type AssessmentContext,
} from "@/lib/assessment/rules";
import type { CurriculumVerificationStatus } from "@/lib/curriculum/exam-selection";
import { BlueprintSummary } from "./blueprint-summary";
import type { Strand, WizardData } from "./types";

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-normal text-foreground/65">{label}</span>
      <span className="text-sm font-semibold text-foreground sm:text-right">
        {value}
      </span>
    </div>
  );
}

function verificationLabel(status: CurriculumVerificationStatus): string {
  if (status === "verified_official") return "Official curriculum";
  if (status === "textbook_verified_kicd_pending") {
    return "Textbook verified / KICD source pending";
  }
  return "Legacy / unverified curriculum";
}

export function StepReview({ data, strands }: { data: WizardData; strands: Strand[] }) {
  const context: AssessmentContext = {
    educationSystem: data.educationSystem || "CBC",
    level: data.level,
    gradeName: data.gradeName,
    subjectName: data.subjectName,
  };
  const assessmentType = getSchoolAssessmentType(data.examType);
  const assessmentRules = resolveAssessmentRules(
    context,
    data.examType,
    data.examStructure
  );
  const componentRule = assessmentRules.officialComponentRule;
  const component = componentRule?.components.find(
    (candidate) => candidate.id === data.componentId
  );
  const isKjseaPractice = data.examStructure === "kjsea_style";
  const selectedStrands = strands
    .map((strand) => ({
      ...strand,
      selectedSubStrands: strand.sub_strands.filter((subStrand) =>
        data.topicIds.includes(subStrand.id)
      ),
    }))
    .filter((strand) => strand.selectedSubStrands.length > 0);
  const selectedSubject = strands[0]?.verification_status ?? "unverified";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Review</h2>
        <p className="mt-1 text-sm font-normal text-foreground/65">
          Check every setting before generating the teacher-review draft.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Class details</h3>
        <ReviewRow
          label="Education system"
          value={data.educationSystem ? educationSystemLabel(data.educationSystem) : "—"}
        />
        <ReviewRow label="Education level" value={data.level} />
        <ReviewRow label="Grade / Form" value={data.gradeName} />
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Subject</h3>
        <ReviewRow label="Subject" value={data.subjectName} />
        <ReviewRow
          label="Curriculum status"
          value={verificationLabel(selectedSubject)}
        />
        {data.textbookName && (
          <ReviewRow label="Reference textbook" value={data.textbookName} />
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Assessment</h3>
        <ReviewRow
          label="Assessment type"
          value={assessmentType?.label ?? "—"}
        />
        <ReviewRow
          label="Structure"
          value={examStructureLabel(data.examStructure, data.examType)}
        />
        {component && (
          <>
            <ReviewRow
              label={`${isKjseaPractice ? "KJSEA" : "KCSE"}-style component`}
              value={component.label}
            />
            <ReviewRow label="Paper code" value={component.paperCode} />
            <ReviewRow
              label="Component type"
              value={
                component.componentType === "PRACTICAL"
                  ? "Practical"
                  : "Written"
              }
            />
            <ReviewRow
              label={`Verified ${isKjseaPractice ? "KJSEA" : "KCSE"} duration`}
              value={`${component.durationMinutes} minutes`}
            />
          </>
        )}
        {!component && componentRule?.verificationStatus === "SOURCE_REQUIRED" && (
          <ReviewRow
            label="Official paper / component"
            value="Not configured — authoritative source required"
          />
        )}
        {data.gradeName === "Form 3" &&
          data.examStructure === "kcse_style" &&
          component && (
            <p className="mt-3 rounded-lg bg-accent/5 px-3 py-2 text-xs leading-relaxed text-foreground/70">
              Uses a verified KCSE component identity and duration for school
              practice. Exact marks, sections and question counts remain unknown.
              This is not an official Form 3 KNEC examination.
            </p>
          )}
        {isKjseaPractice && component && (
          <p className="mt-3 rounded-lg bg-accent/5 px-3 py-2 text-xs leading-relaxed text-foreground/70">
            This is school-generated KJSEA-style practice material using a verified
            KJSEA profile. It is not issued or endorsed by KNEC.
          </p>
        )}
        <ReviewRow label="Term" value={data.term} />
        {data.year && <ReviewRow label="Year" value={String(data.year)} />}
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {data.educationSystem === "8-4-4" ? "Topics" : "Strands"} (
          {selectedStrands.length})
        </h3>
        <div className="flex flex-col gap-4">
          {selectedStrands.map((strand) => (
            <div key={strand.id}>
              <p className="text-sm font-semibold text-foreground">{strand.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {strand.selectedSubStrands.map((subStrand) => (
                  <span
                    key={subStrand.id}
                    className="rounded-lg bg-accent/10 px-3 py-1 text-xs font-semibold text-accent"
                  >
                    {subStrand.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Paper settings</h3>
        <ReviewRow label="Difficulty" value={data.difficulty} />
        <ReviewRow label="Total marks" value={data.marks ? String(data.marks) : "—"} />
        <ReviewRow
          label="Duration"
          value={data.duration ? `${data.duration} minutes` : "—"}
        />
      </div>

      <BlueprintSummary data={data} strands={strands} />

      <p className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-xs leading-relaxed text-foreground/70">
        The generated exam is a draft. A teacher must review, edit or regenerate where
        necessary, and approve it before use.
      </p>
    </div>
  );
}
