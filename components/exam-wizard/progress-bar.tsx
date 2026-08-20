import { Check } from "lucide-react";
import { STEP_LABELS } from "./types";

export function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Create exam progress" className="overflow-x-auto pb-2">
      <ol className="flex min-w-[42rem] items-start">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isLast = stepNumber === STEP_LABELS.length;

          return (
            <li
              key={label}
              className={`flex items-center ${isLast ? "" : "flex-1"}`}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm tabular-nums transition-all ${
                    isActive
                      ? "bg-accent text-white ring-4 ring-accent/15"
                      : isComplete
                        ? "bg-accent text-white"
                        : "border border-border bg-card text-foreground/40"
                  }`}
                >
                  {isComplete ? (
                    <>
                      <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                      <span className="sr-only">Complete</span>
                    </>
                  ) : (
                    stepNumber
                  )}
                </div>
                <span
                  className={`whitespace-nowrap text-xs transition-colors ${
                    isActive
                      ? "font-semibold text-foreground"
                      : "font-normal text-foreground/50"
                  }`}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-2 mb-5 h-px flex-1 transition-colors ${
                    isComplete ? "bg-accent" : "bg-border"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
