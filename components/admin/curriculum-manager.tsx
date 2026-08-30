"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  FilePlus2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  createLearningOutcome,
  createStrand,
  createSubStrand,
  deleteLearningOutcome,
  deleteStrand,
  deleteSubStrand,
  updateLearningOutcome,
  updateStrand,
  updateSubStrand,
  type AdminActionState,
} from "@/app/actions/admin";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  selectClass,
} from "@/components/ui/field-styles";

export type CurriculumGrade = { id: string; name: string; level: string };
export type CurriculumSubject = { id: string; name: string };
export type CurriculumVerificationStatus =
  | "unverified"
  | "verified_official"
  | "textbook_verified_kicd_pending";
export type CurriculumOutcome = {
  id: string;
  description: string;
  sort_order: number;
  verification_status: CurriculumVerificationStatus;
};
export type CurriculumSubStrand = {
  id: string;
  name: string;
  sort_order: number;
  source_code: string | null;
  verification_status: CurriculumVerificationStatus;
  learning_outcomes: CurriculumOutcome[];
};
export type CurriculumStrandObjective = {
  id: string;
  description: string;
  label: string | null;
  sort_order: number;
  verification_status: CurriculumVerificationStatus;
};
export type CurriculumStrand = {
  id: string;
  name: string;
  sort_order: number;
  source_code: string | null;
  verification_status: CurriculumVerificationStatus;
  outcome_status: "unverified" | "sourced" | "source_required";
  strand_objectives: CurriculumStrandObjective[];
  sub_strands: CurriculumSubStrand[];
};

type Terms = {
  strand: string;
  subStrand: string;
  outcome: string;
};

function Feedback({ state }: { state: AdminActionState }) {
  if (!state) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={
        state.status === "error"
          ? "mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          : "mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
      }
    >
      {state.message}
    </p>
  );
}

function VerificationBadge({ status }: { status: CurriculumVerificationStatus }) {
  if (status === "verified_official") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
        Officially verified
      </span>
    );
  }
  if (status === "textbook_verified_kicd_pending") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
        Textbook-verified / KICD pending
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
      Unverified
    </span>
  );
}

function OutcomeItem({
  outcome,
  terms,
}: {
  outcome: CurriculumOutcome;
  terms: Terms;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateLearningOutcome,
    undefined
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteLearningOutcome,
    undefined
  );

  return (
    <article className="rounded-lg border border-border bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-foreground">{outcome.description}</p>
        <VerificationBadge status={outcome.verification_status} />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-accent">
          Edit or delete
        </summary>
        <form action={updateAction} className="mt-3">
          <input type="hidden" name="id" value={outcome.id} />
          <label htmlFor={"outcome-" + outcome.id} className={labelClass}>
            {terms.outcome} wording
          </label>
          <textarea
            id={"outcome-" + outcome.id}
            name="description"
            required
            maxLength={1000}
            rows={3}
            defaultValue={outcome.description}
            className={inputClass + " resize-y"}
          />
          <button
            type="submit"
            disabled={updatePending}
            className={primaryButtonClass + " mt-3"}
          >
            <Save size={15} aria-hidden="true" />
            {updatePending ? "Saving…" : "Save wording"}
          </button>
          <Feedback state={updateState} />
        </form>
        <form
          action={deleteAction}
          className="mt-4 border-t border-border pt-3"
          onSubmit={(event) => {
            if (!window.confirm("Delete this " + terms.outcome.toLocaleLowerCase("en") + "?")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={outcome.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 hover:text-red-800 disabled:opacity-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            {deletePending ? "Deleting…" : "Delete"}
          </button>
          <Feedback state={deleteState} />
        </form>
      </details>
    </article>
  );
}

function CreateOutcomeForm({
  subStrandId,
  terms,
}: {
  subStrandId: string;
  terms: Terms;
}) {
  const [state, action, pending] = useActionState(createLearningOutcome, undefined);
  return (
    <form action={action} className="mt-4 rounded-lg border border-dashed border-border p-4">
      <input type="hidden" name="subStrandId" value={subStrandId} />
      <label htmlFor={"new-outcome-" + subStrandId} className={labelClass}>
        Add {terms.outcome.toLocaleLowerCase("en")}
      </label>
      <textarea
        id={"new-outcome-" + subStrandId}
        name="description"
        required
        maxLength={1000}
        rows={3}
        className={inputClass + " resize-y"}
        placeholder={"Enter exact official wording when a source is available"}
      />
      <button type="submit" disabled={pending} className={primaryButtonClass + " mt-3"}>
        <Plus size={15} aria-hidden="true" />
        {pending ? "Adding…" : "Add as unverified"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

function SubStrandItem({
  subStrand,
  terms,
}: {
  subStrand: CurriculumSubStrand;
  terms: Terms;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateSubStrand,
    undefined
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteSubStrand,
    undefined
  );

  return (
    <details className="rounded-lg border border-border bg-card" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight size={16} className="shrink-0 text-foreground/40" aria-hidden="true" />
          <span className="truncate text-sm font-semibold text-foreground">{subStrand.name}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-foreground/65">
            {subStrand.learning_outcomes.length} {terms.outcome.toLocaleLowerCase("en")}
            {subStrand.learning_outcomes.length === 1 ? "" : "s"}
          </span>
          <VerificationBadge status={subStrand.verification_status} />
        </span>
      </summary>
      <div className="border-t border-border p-4">
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-accent">
            Manage {terms.subStrand.toLocaleLowerCase("en")}
          </summary>
          <form action={updateAction} className="mt-3">
            <input type="hidden" name="id" value={subStrand.id} />
            <label htmlFor={"sub-strand-" + subStrand.id} className={labelClass}>
              Exact {terms.subStrand.toLocaleLowerCase("en")} name
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id={"sub-strand-" + subStrand.id}
                name="name"
                required
                maxLength={180}
                defaultValue={subStrand.name}
                className={inputClass}
              />
              <button type="submit" disabled={updatePending} className={primaryButtonClass}>
                {updatePending ? "Saving…" : "Save"}
              </button>
            </div>
            <Feedback state={updateState} />
          </form>
          <form
            action={deleteAction}
            className="mt-4"
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Delete " +
                    subStrand.name +
                    "? Deletion is blocked while learning outcomes/objectives remain."
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={subStrand.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 hover:text-red-800 disabled:opacity-50"
            >
              <Trash2 size={14} aria-hidden="true" />
              {deletePending ? "Checking…" : "Delete safely"}
            </button>
            <Feedback state={deleteState} />
          </form>
        </details>

        <div className="mt-4 space-y-3">
          {subStrand.learning_outcomes.length === 0 ? (
            <p className="rounded-lg bg-background px-4 py-5 text-center text-sm text-foreground/65">
              No {terms.outcome.toLocaleLowerCase("en")} records yet.
            </p>
          ) : (
            subStrand.learning_outcomes.map((outcome) => (
              <OutcomeItem key={outcome.id} outcome={outcome} terms={terms} />
            ))
          )}
        </div>
        <CreateOutcomeForm subStrandId={subStrand.id} terms={terms} />
      </div>
    </details>
  );
}

function CreateSubStrandForm({
  strandId,
  terms,
}: {
  strandId: string;
  terms: Terms;
}) {
  const [state, action, pending] = useActionState(createSubStrand, undefined);
  return (
    <form action={action} className="rounded-lg border border-dashed border-border p-4">
      <input type="hidden" name="strandId" value={strandId} />
      <label htmlFor={"new-sub-strand-" + strandId} className={labelClass}>
        Add {terms.subStrand.toLocaleLowerCase("en")}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={"new-sub-strand-" + strandId}
          name="name"
          required
          maxLength={180}
          className={inputClass}
          placeholder="Enter exact official wording when a source is available"
        />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          <Plus size={15} aria-hidden="true" />
          {pending ? "Adding…" : "Add as unverified"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

function StrandItem({
  strand,
  terms,
}: {
  strand: CurriculumStrand;
  terms: Terms;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateStrand,
    undefined
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteStrand,
    undefined
  );

  return (
    <details className="rounded-lg border border-border bg-background/30 shadow-sm" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="flex min-w-0 items-center gap-3">
          <BookOpen size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate font-semibold text-foreground">{strand.name}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-foreground/65">
            {strand.sub_strands.length} {terms.subStrand.toLocaleLowerCase("en")}
            {strand.sub_strands.length === 1 ? "" : "s"}
          </span>
          <VerificationBadge status={strand.verification_status} />
        </span>
      </summary>
      <div className="border-t border-border p-5">
        {strand.source_code && (
          <p className="mb-3 text-xs font-semibold text-foreground/65">
            Official code: {strand.source_code}
          </p>
        )}
        {strand.outcome_status === "source_required" && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Exact objectives/outcomes are source-required and have not been invented.
          </p>
        )}
        {strand.strand_objectives.length > 0 && (
          <section className="mb-5 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                Official topic-level objectives
              </h4>
              <VerificationBadge status={strand.strand_objectives[0].verification_status} />
            </div>
            <ol className="mt-3 space-y-2 pl-5 text-sm text-foreground/80">
              {strand.strand_objectives.map((objective) => (
                <li key={objective.id} className="list-decimal leading-relaxed">
                  {objective.label && <span className="mr-2 font-semibold">{objective.label}</span>}
                  {objective.description}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-foreground/65">
              These objectives apply to the official topic as a whole; no one-to-one sub-topic mapping is claimed.
            </p>
          </section>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-accent">
            Manage {terms.strand.toLocaleLowerCase("en")}
          </summary>
          <form action={updateAction} className="mt-4">
            <input type="hidden" name="id" value={strand.id} />
            <label htmlFor={"strand-" + strand.id} className={labelClass}>
              Exact {terms.strand.toLocaleLowerCase("en")} name
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id={"strand-" + strand.id}
                name="name"
                required
                maxLength={180}
                defaultValue={strand.name}
                className={inputClass}
              />
              <button type="submit" disabled={updatePending} className={primaryButtonClass}>
                <Save size={15} aria-hidden="true" />
                {updatePending ? "Saving…" : "Save"}
              </button>
            </div>
            <Feedback state={updateState} />
          </form>
          <form
            action={deleteAction}
            className="mt-4"
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Delete " +
                    strand.name +
                    "? Deletion is blocked while sub-strands/sub-topics remain."
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={strand.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:text-red-800 disabled:opacity-50"
            >
              <Trash2 size={15} aria-hidden="true" />
              {deletePending ? "Checking…" : "Delete safely"}
            </button>
            <Feedback state={deleteState} />
          </form>
        </details>

        <div className="mt-5 space-y-4">
          {strand.sub_strands.length === 0 ? (
            <p className="rounded-lg bg-card px-4 py-6 text-center text-sm text-foreground/65">
              No {terms.subStrand.toLocaleLowerCase("en")} records yet.
            </p>
          ) : (
            strand.sub_strands.map((subStrand) => (
              <SubStrandItem key={subStrand.id} subStrand={subStrand} terms={terms} />
            ))
          )}
          <CreateSubStrandForm strandId={strand.id} terms={terms} />
        </div>
      </div>
    </details>
  );
}

function CreateStrandForm({
  gradeId,
  subjectId,
  terms,
}: {
  gradeId: string;
  subjectId: string;
  terms: Terms;
}) {
  const [state, action, pending] = useActionState(createStrand, undefined);
  return (
    <form action={action} className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <input type="hidden" name="gradeId" value={gradeId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="flex items-center gap-2">
        <FilePlus2 size={18} className="text-accent" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">
          Add {terms.strand.toLocaleLowerCase("en")}
        </h3>
      </div>
      <label htmlFor="new-strand" className={labelClass + " mt-4"}>
        Exact {terms.strand.toLocaleLowerCase("en")} name
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="new-strand"
          name="name"
          required
          maxLength={180}
          className={inputClass}
          placeholder="Enter exact official wording when a source is available"
        />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          <Plus size={15} aria-hidden="true" />
          {pending ? "Adding…" : "Add as unverified"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function CurriculumManager({
  grades,
  subjects,
  selectedGrade,
  selectedSubject,
  strands,
}: {
  grades: CurriculumGrade[];
  subjects: CurriculumSubject[];
  selectedGrade: CurriculumGrade | null;
  selectedSubject: CurriculumSubject | null;
  strands: CurriculumStrand[];
}) {
  const router = useRouter();
  const terms: Terms =
    selectedGrade?.level === "Secondary"
      ? { strand: "Topic", subStrand: "Sub-topic", outcome: "Specific objective" }
      : {
          strand: "Strand",
          subStrand: "Sub-strand",
          outcome: "Specific learning outcome",
        };

  function chooseGrade(gradeId: string) {
    const params = new URLSearchParams();
    if (gradeId) params.set("grade", gradeId);
    router.push("/admin/curriculum" + (params.size ? "?" + params.toString() : ""));
  }

  function chooseSubject(subjectId: string) {
    const params = new URLSearchParams();
    if (selectedGrade) params.set("grade", selectedGrade.id);
    if (subjectId) params.set("subject", subjectId);
    router.push("/admin/curriculum" + (params.size ? "?" + params.toString() : ""));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Source status is shown per record</h3>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
              Officially imported rows retain their source wording, codes, and order. Legacy seed data
              and manual edits remain unverified. Textbook-supported rows stay explicitly pending until
              checked against an authoritative KICD source.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold text-foreground">Choose curriculum context</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="curriculum-grade" className={labelClass}>Grade or class</label>
            <select
              id="curriculum-grade"
              value={selectedGrade?.id ?? ""}
              onChange={(event) => chooseGrade(event.target.value)}
              className={selectClass}
            >
              <option value="">Select grade or class</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name} — {grade.level}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="curriculum-subject" className={labelClass}>Subject</label>
            <select
              id="curriculum-subject"
              value={selectedSubject?.id ?? ""}
              onChange={(event) => chooseSubject(event.target.value)}
              disabled={!selectedGrade}
              className={selectClass}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </div>
        </div>
        {selectedGrade && selectedSubject && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
              {selectedGrade.name}
            </span>
            <ChevronRight size={15} className="text-foreground/40" aria-hidden="true" />
            <span className="rounded-full bg-accent/10 px-3 py-1 font-semibold text-accent">
              {selectedSubject.name}
            </span>
          </div>
        )}
      </section>

      {!selectedGrade || !selectedSubject ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
          <BookOpen size={28} className="mx-auto text-foreground/30" aria-hidden="true" />
          <p className="mt-3 font-semibold text-foreground">Select a grade and subject</p>
          <p className="mt-1 text-sm text-foreground/65">
            The matching curriculum hierarchy will load here.
          </p>
        </div>
      ) : (
        <>
          <CreateStrandForm
            gradeId={selectedGrade.id}
            subjectId={selectedSubject.id}
            terms={terms}
          />
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">
                {terms.strand}s for {selectedGrade.name} · {selectedSubject.name}
              </h3>
              <span className="text-sm text-foreground/65">
                {strands.length} record{strands.length === 1 ? "" : "s"}
              </span>
            </div>
            {strands.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
                <p className="font-semibold text-foreground">No {terms.strand.toLocaleLowerCase("en")} records</p>
                <p className="mt-1 text-sm text-foreground/65">
                  Add one only when you have the exact source wording.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {strands.map((strand) => (
                  <StrandItem key={strand.id} strand={strand} terms={terms} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
