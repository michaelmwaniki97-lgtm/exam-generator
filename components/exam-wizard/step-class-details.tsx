import {
  educationSystemLabel,
  inferEducationSystem,
  type EducationSystem,
} from "@/lib/assessment/rules";
import type { Grade, WizardData } from "./types";
import { labelClass, selectClass } from "@/components/ui/field-styles";

export function StepClassDetails({
  data,
  onChange,
  grades,
  loading,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  grades: Grade[];
  loading: boolean;
}) {
  const gradesForSystem = grades.filter(
    (grade) => inferEducationSystem(grade.name) === data.educationSystem
  );
  const levels = [...new Set(gradesForSystem.map((grade) => grade.level))];
  const gradesForLevel = gradesForSystem.filter((grade) => grade.level === data.level);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Class details</h2>
        <p className="mt-1 text-sm font-normal text-foreground/65">
          Choose the education system, level, and supported Grade or Form.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="educationSystem" className={labelClass}>
            Education system <span className="text-accent">*</span>
          </label>
          <select
            id="educationSystem"
            className={selectClass}
            value={data.educationSystem}
            disabled={loading}
            onChange={(event) =>
              onChange({
                educationSystem: event.target.value as EducationSystem | "",
              })
            }
          >
            <option value="">{loading ? "Loading..." : "Select a system"}</option>
            <option value="CBC">{educationSystemLabel("CBC")}</option>
            <option value="8-4-4">{educationSystemLabel("8-4-4")}</option>
          </select>
        </div>

        <div>
          <label htmlFor="level" className={labelClass}>
            Education level <span className="text-accent">*</span>
          </label>
          <select
            id="level"
            className={selectClass}
            value={data.level}
            disabled={!data.educationSystem}
            onChange={(event) => onChange({ level: event.target.value })}
          >
            <option value="">
              {data.educationSystem ? "Select a level" : "Select a system first"}
            </option>
            {levels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="grade" className={labelClass}>
            Grade / Form <span className="text-accent">*</span>
          </label>
          <select
            id="grade"
            className={selectClass}
            value={data.gradeId}
            disabled={!data.level}
            onChange={(event) => {
              const grade = gradesForLevel.find(
                (candidate) => candidate.id === event.target.value
              );
              onChange({
                gradeId: grade?.id ?? "",
                gradeName: grade?.name ?? "",
              });
            }}
          >
            <option value="">
              {data.level ? "Select a Grade or Form" : "Select a level first"}
            </option>
            {gradesForLevel.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs font-normal text-foreground/55">
            Only Grades 1–9 and Forms 1–4 with active curriculum are available for
            new exams.
          </p>
        </div>
      </div>
    </div>
  );
}
