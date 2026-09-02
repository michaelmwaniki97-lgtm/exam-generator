"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  ClipboardCheck,
  FileText,
  PencilLine,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

const previewTabs = [
  { id: "settings", label: "Assessment settings", icon: SlidersHorizontal },
  { id: "paper", label: "Exam paper", icon: FileText },
  { id: "marking", label: "Marking scheme", icon: ClipboardCheck },
  { id: "edit", label: "Edit / regenerate", icon: PencilLine },
] as const;

type PreviewId = (typeof previewTabs)[number]["id"];

const questions = [
  "State two properties of acids.",
  "Calculate the amount of substance in the sample shown.",
  "Explain the observation recorded in the table.",
];

function SettingsPreview() {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <p className="text-xs font-semibold text-foreground/65">Create exam</p>
          <p className="mt-0.5 text-sm font-bold">Assessment settings</p>
        </div>
        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent">Step 5 of 6</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-left">
        {[["Grade / Form", "Form 3"], ["Subject", "Chemistry"], ["Term", "Term 2"], ["Difficulty", "Moderate"]].map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] font-semibold text-foreground/65">{label}</p>
            <div className="mt-1 rounded-md border border-border bg-background/60 px-2.5 py-2 text-xs font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-semibold text-foreground/65">Selected topics</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {["Acids & bases", "Mole concept", "Organic chemistry"].map((topic) => (
            <span key={topic} className="rounded-md bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">{topic}</span>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-lg bg-background px-3 py-3">
        <p className="text-[10px] text-foreground/65">Paper</p>
        <p className="text-xs font-bold">50 marks · 60 minutes</p>
      </div>
    </div>
  );
}

function ExamPaperPreview() {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-md bg-white p-5 shadow-sm sm:p-7">
      <div className="border-b border-foreground/40 pb-3 text-center font-serif">
        <p className="text-[9px] font-bold uppercase tracking-wider">School assessment</p>
        <p className="mt-1 text-sm font-bold uppercase">Chemistry revision test</p>
        <p className="mt-1 text-[9px] text-foreground/65">Form 3 · 50 marks · 60 minutes</p>
      </div>
      <div className="mt-4 rounded-sm border border-foreground/30 p-2.5 font-serif text-[9px]">
        <b>Instructions</b>
        <p className="mt-1 text-foreground/70">Answer all questions. Show all necessary working.</p>
      </div>
      <div className="mt-5 space-y-4 font-serif text-[9px] leading-relaxed">
        {questions.map((question, index) => (
          <div key={question} className="flex gap-2">
            <b>{index + 1}.</b>
            <div className="flex-1"><p>{question}</p><div className="mt-2 h-px bg-border" /></div>
            <b>[{index + 2}]</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarkingSchemePreview() {
  const guidance = [
    ["Any two: sour taste; turns blue litmus red; reacts with bases.", "2"],
    ["Award for the correct formula, substitution and final answer with unit.", "3"],
    ["Links the observed change to the relevant chemical process.", "4"],
  ];

  return (
    <div className="mx-auto w-full max-w-2xl rounded-md bg-white p-5 shadow-sm sm:p-7">
      <div className="border-b border-foreground/40 pb-3 text-center font-serif">
        <p className="text-[9px] font-bold uppercase tracking-wider">Confidential</p>
        <p className="mt-1 text-sm font-bold uppercase">Chemistry marking scheme</p>
        <p className="mt-1 text-[9px] text-foreground/65">Form 3 · Teacher copy</p>
      </div>
      <div className="mt-4 space-y-3 font-serif text-[9px] leading-relaxed">
        {guidance.map(([answer, marks], index) => (
          <div key={answer} className="grid grid-cols-[1.5rem_1fr_2rem] gap-2 border-b border-border pb-3 last:border-0">
            <b>{index + 1}.</b>
            <p>{answer}</p>
            <b className="text-right">[{marks}]</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditPreview() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold">Question 2</p>
            <p className="mt-1 text-[10px] text-foreground/65">Chemistry · 3 marks</p>
          </div>
          <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent">Short answer</span>
        </div>
        <div className="mt-4 rounded-md border border-border bg-background/50 p-3 text-xs leading-5">
          A sample has a mass of 4.0 g. Calculate the amount in moles and show your working.
        </div>
        <div className="mt-3 rounded-md border border-border bg-background/50 p-3 text-xs leading-5 text-foreground/70">
          Marking guidance can be reviewed and edited alongside the question.
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-foreground">
            <RefreshCw size={13} className="text-accent" aria-hidden="true" />Regenerate this question
          </span>
          <span className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-2 text-background">
            Review and save edits
          </span>
        </div>
      </div>
      <p className="px-1 text-[10px] leading-4 text-foreground/60">Individual questions can be refined without rebuilding the entire paper.</p>
    </div>
  );
}

const panels: Record<PreviewId, () => React.ReactNode> = {
  settings: SettingsPreview,
  paper: ExamPaperPreview,
  marking: MarkingSchemePreview,
  edit: EditPreview,
};

export function ProductPreview() {
  const [activeTab, setActiveTab] = useState<PreviewId>("paper");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const ActivePanel = panels[activeTab];

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % previewTabs.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + previewTabs.length) % previewTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = previewTabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    setActiveTab(previewTabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl border border-white/10 bg-sidebar p-2 shadow-[0_24px_65px_rgb(26_29_46_/_16%)] sm:p-3">
      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4 sm:px-5">
          <p className="text-sm font-bold text-white">Exam Generator</p>
          <p className="hidden text-[10px] font-semibold text-sidebar-foreground sm:block">Teacher workspace preview</p>
        </div>
        <div className="grid min-w-0 md:grid-cols-[12rem_minmax(0,1fr)]">
          <div
            role="tablist"
            aria-label="Product capabilities"
            className="flex gap-1 overflow-x-auto border-b border-white/10 p-2 md:block md:border-b-0 md:border-r md:p-3"
          >
            {previewTabs.map(({ id, label, icon: Icon }, index) => {
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  ref={(element) => { tabRefs.current[index] = element; }}
                  id={`preview-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`preview-panel-${id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(id)}
                  onKeyDown={(event) => selectFromKeyboard(event, index)}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.98] motion-reduce:transform-none md:mb-1 md:flex md:w-full ${selected ? "bg-white/10 text-white" : "text-sidebar-foreground hover:bg-white/5 hover:text-white"}`}
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
          <div
            key={activeTab}
            id={`preview-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`preview-tab-${activeTab}`}
            tabIndex={0}
            className="product-preview-panel h-[31rem] overflow-y-auto bg-background p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:h-[29rem] sm:p-6"
          >
            <ActivePanel />
          </div>
        </div>
      </div>
    </div>
  );
}
