import { Check } from "lucide-react";
import { STEP_LABELS } from "./types";

export function ProgressBar({ currentStep }: { currentStep: number }) {
  const currentLabel = STEP_LABELS[currentStep - 1];

  return (
    <nav aria-label="Create exam progress">
      <div className="mb-3 flex items-center justify-between md:hidden">
        <div>
          <p className="text-xs font-medium text-foreground/55">Step {currentStep} of {STEP_LABELS.length}</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{currentLabel}</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-foreground/55">{Math.round((currentStep / STEP_LABELS.length) * 100)}%</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5 md:hidden" aria-hidden="true">
        {STEP_LABELS.map((label, index) => (
          <span key={label} className={`h-1 rounded-full transition-colors duration-200 ${index < currentStep ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>

      <ol className="hidden grid-cols-6 items-start md:grid">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isLast = stepNumber === STEP_LABELS.length;

          return (
            <li key={label} className={`flex min-w-0 items-center ${isLast ? "" : "flex-1"}`} aria-current={isActive ? "step" : undefined}>
              <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs tabular-nums transition-[background-color,color,box-shadow] duration-200 ${isActive ? "bg-accent text-white ring-4 ring-accent/15" : isComplete ? "bg-accent text-white" : "border border-border bg-card text-foreground/55"}`}>
                  {isComplete ? <><Check size={15} strokeWidth={2.5} aria-hidden="true" /><span className="sr-only">Complete</span></> : stepNumber}
                </div>
                <span className={`max-w-24 text-xs leading-4 ${isActive ? "font-semibold text-foreground" : "font-normal text-foreground/55"}`}>{label}</span>
              </div>
              {!isLast && <div className={`mx-2 mb-6 h-px min-w-2 flex-1 transition-colors duration-200 ${isComplete ? "bg-accent" : "bg-border"}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
