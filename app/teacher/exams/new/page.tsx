import { ExamWizard } from "@/components/exam-wizard/exam-wizard";

export const maxDuration = 300;

export default function CreateExamPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Build a new assessment</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/65">
          Work through each step to define the curriculum, paper settings, and final exam plan.
        </p>
      </div>
      <ExamWizard />
    </div>
  );
}
