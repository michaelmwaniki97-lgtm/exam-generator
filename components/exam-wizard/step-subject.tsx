import type { Subject, Textbook, WizardData } from "./types";
import { labelClass, selectClass } from "@/components/ui/field-styles";

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
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Subject</h2>
        <p className="mt-1 text-sm font-normal text-foreground/65">
          Choose a subject with mapped curriculum for {data.gradeName}. You will
          select its topics and sub-topics next; a textbook is optional extra grounding.
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
                {subject.name}
              </option>
            ))}
          </select>
          {!loadingSubjects && subjects.length === 0 && (
            <p className="mt-1.5 text-xs font-normal text-foreground/65">
              No active curriculum is available for {data.gradeName}.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="textbook" className={labelClass}>
            Reference textbook (optional)
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
