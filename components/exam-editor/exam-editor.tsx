"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Save } from "lucide-react";
import { regenerateExamQuestion, saveExamEdits } from "@/app/actions/exam-editor";
import type { EditableSlotInput, StoredExamContent, StoredMarkingContent } from "@/lib/exam-editor/core";

function initialInputs(exam: StoredExamContent, marking: StoredMarkingContent): EditableSlotInput[] {
  const entries = new Map(marking.entries.map((entry) => [entry.slotId, entry]));
  return exam.sections.flatMap((section) => section.questions.map((question) => {
    const entry = entries.get(question.slotId)!;
    return { slotId: question.slotId, questionText: question.text, ...(question.options ? { options: [...question.options] } : {}), answer: entry.answer, markingNotes: entry.marking_notes, allocationLabels: (entry.allocations ?? []).map((allocation) => allocation.label) };
  }));
}

export function ExamEditor({ examId, initialRevision, exam, marking }: { examId: string; initialRevision: number; exam: StoredExamContent; marking: StoredMarkingContent }) {
  const router = useRouter();
  const baseline = useMemo(() => initialInputs(exam, marking), [exam, marking]);
  const [inputs, setInputs] = useState(baseline);
  const [revision, setRevision] = useState(initialRevision);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(inputs) !== JSON.stringify(baseline);
  const questions = exam.sections.flatMap((section) => section.questions.map((question) => ({ section, question })));
  const entries = new Map(marking.entries.map((entry) => [entry.slotId, entry]));
  const update = (slotId: string, change: Partial<EditableSlotInput>) => setInputs((current) => current.map((input) => input.slotId === slotId ? { ...input, ...change } : input));

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveExamEdits(examId, revision, inputs);
      if (!result.ok) return setMessage({ kind: "error", text: result.error });
      setRevision(result.revision); setMessage({ kind: "success", text: "Exam and marking scheme saved together." }); router.refresh();
    });
  }

  function regenerate(slotId: string) {
    if (dirty) return setMessage({ kind: "error", text: "Save or refresh your current edits before regenerating a question." });
    setMessage(null); setActiveSlot(slotId);
    startTransition(async () => {
      const result = await regenerateExamQuestion(examId, slotId, revision);
      setActiveSlot(null);
      if (!result.ok) return setMessage({ kind: "error", text: result.error });
      setRevision(result.revision); setMessage({ kind: "success", text: "The question and its matching marking entry were regenerated." }); router.refresh();
    });
  }

  return <div className="flex flex-col gap-6">
    {message && <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${message.kind === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-green-300 bg-green-50 text-green-800"}`}>{message.text}</p>}
    {questions.map(({ section, question }) => {
      const input = inputs.find((item) => item.slotId === question.slotId)!;
      const entry = entries.get(question.slotId)!;
      return <section key={question.slotId} className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div><h3 className="font-bold text-foreground">Question {question.number}</h3><p className="mt-1 text-xs text-foreground/60">{section.title} · {question.marks} marks · {question.questionFamily.replaceAll("_", " ")} · Topic: {question.topic}</p></div>
          <button type="button" disabled={pending} onClick={() => regenerate(question.slotId)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15} className={activeSlot === question.slotId ? "animate-spin" : ""} />{activeSlot === question.slotId ? "Regenerating…" : "Regenerate this question"}</button>
        </div>
        <div className="mt-4 grid gap-4">
          <label className="text-sm font-semibold">Question text<textarea value={input.questionText} maxLength={8000} onChange={(event) => update(question.slotId, { questionText: event.target.value })} className="mt-1 min-h-28 w-full rounded-lg border border-border bg-background p-3 font-normal" /></label>
          {input.options && <div className="grid gap-2"><p className="text-sm font-semibold">Options</p>{input.options.map((option, index) => <label key={index} className="flex items-center gap-2 text-sm"><span className="w-5 font-semibold">{String.fromCharCode(65 + index)}.</span><input value={option} maxLength={1000} onChange={(event) => { const options = [...input.options!]; options[index] = event.target.value; update(question.slotId, { options }); }} className="w-full rounded-lg border border-border bg-background px-3 py-2" /></label>)}</div>}
          <label className="text-sm font-semibold">Model answer<textarea value={input.answer} maxLength={12000} onChange={(event) => update(question.slotId, { answer: event.target.value })} className="mt-1 min-h-24 w-full rounded-lg border border-border bg-background p-3 font-normal" /></label>
          <label className="text-sm font-semibold">Marking notes<textarea value={input.markingNotes} maxLength={8000} onChange={(event) => update(question.slotId, { markingNotes: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-border bg-background p-3 font-normal" /></label>
          <div><p className="text-sm font-semibold">Awardable marking points</p><div className="mt-2 grid gap-2">{(entry.allocations ?? []).map((allocation, index) => <label key={index} className="flex items-center gap-3 text-sm"><input value={input.allocationLabels[index]} maxLength={2000} onChange={(event) => { const allocationLabels = [...input.allocationLabels]; allocationLabels[index] = event.target.value; update(question.slotId, { allocationLabels }); }} className="w-full rounded-lg border border-border bg-background px-3 py-2" /><span className="shrink-0 font-semibold">{allocation.marks} mark{allocation.marks === 1 ? "" : "s"}</span></label>)}</div></div>
        </div>
      </section>;
    })}
    <div className="sticky bottom-4 flex justify-end"><button type="button" disabled={pending || !dirty} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-3 text-sm font-bold text-background shadow-lg disabled:opacity-50"><Save size={16} />{pending ? "Saving…" : "Save exam edits"}</button></div>
  </div>;
}
