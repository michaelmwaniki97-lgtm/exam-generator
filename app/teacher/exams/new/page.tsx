import { ExamWizard } from "@/components/exam-wizard/exam-wizard";

export const maxDuration = 300;

export default function CreateExamPage() {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-2xl font-bold text-foreground">Create Exam</h2>
      <ExamWizard />
    </div>
  );
}
