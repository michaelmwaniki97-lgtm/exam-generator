import { APPLICATION_EXAM_LIMITS } from "@/lib/assessment/rules";
import type { WizardData } from "./types";
import { inputClass, labelClass, selectClass } from "@/components/ui/field-styles";

export function StepSettings({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Paper settings</h2>
        <p className="mt-1 text-sm font-normal text-foreground/65">
          Review the editable application defaults, then set the required difficulty.
          These values are not presented as KNEC or KICD rules.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="difficulty" className={labelClass}>
            Difficulty <span className="text-accent">*</span>
          </label>
          <select
            id="difficulty"
            className={selectClass}
            value={data.difficulty}
            onChange={(event) =>
              onChange({
                difficulty: event.target.value as WizardData["difficulty"],
              })
            }
          >
            <option value="">Select difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        <div>
          <label htmlFor="marks" className={labelClass}>
            Total marks <span className="text-accent">*</span>
          </label>
          <input
            id="marks"
            type="number"
            min={APPLICATION_EXAM_LIMITS.marks.min}
            max={APPLICATION_EXAM_LIMITS.marks.max}
            step={1}
            className={inputClass}
            readOnly={data.examStructure === "kjsea_style"}
            value={data.marks ?? ""}
            onChange={(event) =>
              onChange({
                marks: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
          <p className="mt-1.5 text-xs text-foreground/65">
            Application limit: {APPLICATION_EXAM_LIMITS.marks.min}–
            {APPLICATION_EXAM_LIMITS.marks.max} marks.
          </p>
        </div>

        <div>
          <label htmlFor="duration" className={labelClass}>
            Duration (minutes) <span className="text-accent">*</span>
          </label>
          <input
            id="duration"
            type="number"
            min={APPLICATION_EXAM_LIMITS.durationMinutes.min}
            max={APPLICATION_EXAM_LIMITS.durationMinutes.max}
            step={1}
            className={inputClass}
            readOnly={data.examStructure !== "standard"}
            value={data.duration ?? ""}
            onChange={(event) =>
              onChange({
                duration: event.target.value ? Number(event.target.value) : null,
              })
            }
          />
          <p className="mt-1.5 text-xs text-foreground/65">
            {data.examStructure !== "standard"
              ? "Verified national-practice duration is fixed by the selected component."
              : `Application limit: ${APPLICATION_EXAM_LIMITS.durationMinutes.min}–${APPLICATION_EXAM_LIMITS.durationMinutes.max} minutes.`}
          </p>
        </div>
      </div>
    </div>
  );
}
