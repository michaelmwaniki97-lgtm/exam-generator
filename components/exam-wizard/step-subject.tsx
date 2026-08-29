import type { CurriculumVerificationStatus } from "@/lib/curriculum/exam-selection";
import type { Subject, Textbook, WizardData } from "./types";
import { labelClass, selectClass } from "@/components/ui/field-styles";

function verificationLabel(status: CurriculumVerificationStatus): string {
  if (status === "verified_official") return "Official curriculum";
  if (status === "textbook_verified_kicd_pending") {
    return "Textbook verified / KICD source pending";
  }
  return "Legacy / unverified curriculum";
}

export function StepSubject({
  data,
  onChange,
  subjects,
  textbooks,
  loadingSubjects,
  loadingTextbooks,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  subjects: Subject[];
  textbooks: Textbook[];
  loadingSubjects: boolean;
  loadingTextbooks: boolean;
}) {
  const selectedSubject = subjects.find((subject) => subject.id === data.subjectId);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Subject &amp; textbook</h2>
        <p className="mt-1 text-sm font-normal text-foreground/65">
          Subjects are limited to active curriculum available for {data.gradeName}.
          A reference textbook is optional.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="subject" className={labelClass}>
            Subject <span className="text-accent">*</span>
          </label>
          <select
            id="subject"
            className={selectClass}
            value={data.subjectId}
            disabled={loadingSubjects}
            onChange={(event) => {
              const subject = subjects.find(
                (candidate) => candidate.id === event.target.value
              );
              onChange({
                subjectId: subject?.id ?? "",
                subjectName: subject?.name ?? "",
              });
            }}
          >
            <option value="">
              {loadingSubjects ? "Loading..." : "Select a subject"}
            </option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} — {verificationLabel(subject.verification_status)}
              </option>
            ))}
          </select>
          {selectedSubject && (
            <p
              className={
                selectedSubject.verification_status === "verified_official"
                  ? "mt-2 text-xs font-semibold text-emerald-800"
                  : "mt-2 text-xs font-semibold text-amber-800"
              }
            >
              {verificationLabel(selectedSubject.verification_status)}
            </p>
          )}
          {!loadingSubjects && subjects.length === 0 && (
            <p className="mt-1.5 text-xs font-normal text-foreground/55">
              No active curriculum is available for {data.gradeName}.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="textbook" className={labelClass}>
            Reference textbook
          </label>
          <select
            id="textbook"
            className={selectClass}
            value={data.textbookId}
            disabled={!data.subjectId || loadingTextbooks}
            onChange={(event) => {
              const textbook = textbooks.find(
                (candidate) => candidate.id === event.target.value
              );
              onChange({
                textbookId: textbook?.id ?? "",
                textbookName: textbook?.name ?? "",
              });
            }}
          >
            <option value="">
              {loadingTextbooks
                ? "Loading..."
                : textbooks.length === 0 && data.subjectId
                  ? "No textbooks on file"
                  : "None (optional)"}
            </option>
            {textbooks.map((textbook) => (
              <option key={textbook.id} value={textbook.id}>
                {textbook.name}
                {textbook.publisher ? ` (${textbook.publisher})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
