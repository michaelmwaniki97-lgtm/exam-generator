"use client";

import { useEffect, useRef } from "react";
import type { CurriculumVerificationStatus } from "@/lib/curriculum/exam-selection";
import type { Strand, WizardData } from "./types";

function verificationLabel(status: CurriculumVerificationStatus): string {
  if (status === "verified_official") return "Official";
  if (status === "textbook_verified_kicd_pending") {
    return "Textbook / KICD pending";
  }
  return "Unverified";
}

function StrandToggle({
  checked,
  partiallyChecked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  partiallyChecked: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partiallyChecked;
  }, [partiallyChecked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 rounded border-border text-accent accent-accent"
      checked={checked}
      disabled={disabled}
      aria-label={`Select all sub-areas in ${label}`}
      onChange={onChange}
    />
  );
}

export function StepTopics({
  data,
  onChange,
  strands,
  loading,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  strands: Strand[];
  loading: boolean;
}) {
  const isForm = data.educationSystem === "8-4-4";
  const parentLabel = isForm ? "topics" : "strands";
  const childLabel = isForm ? "sub-topics" : "sub-strands";
  const allIds = strands.flatMap((strand) =>
    strand.sub_strands.map((subStrand) => subStrand.id)
  );

  const toggleTopic = (id: string) => {
    const isSelected = data.topicIds.includes(id);
    onChange({
      topicIds: isSelected
        ? data.topicIds.filter((topicId) => topicId !== id)
        : [...data.topicIds, id],
    });
  };

  const toggleStrand = (strand: Strand) => {
    const subIds = strand.sub_strands.map((subStrand) => subStrand.id);
    const allSelected =
      subIds.length > 0 && subIds.every((id) => data.topicIds.includes(id));
    onChange({
      topicIds: allSelected
        ? data.topicIds.filter((id) => !subIds.includes(id))
        : [...new Set([...data.topicIds, ...subIds])],
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isForm ? "Topics & sub-topics" : "Strands & sub-strands"}
          </h2>
          <p className="mt-1 text-sm font-normal text-foreground/60">
            Select one, several, or all active curriculum areas covered for{" "}
            {data.subjectName} in {data.gradeName}.
          </p>
        </div>
        {!loading && allIds.length > 0 && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:border-accent/40"
              onClick={() => onChange({ topicIds: allIds })}
            >
              Select all
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold text-foreground/70 transition-colors hover:border-accent/40"
              onClick={() => onChange({ topicIds: [] })}
              disabled={data.topicIds.length === 0}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {loading && (
        <p className="text-sm font-normal text-foreground/60">
          Loading active curriculum...
        </p>
      )}

      {!loading && strands.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-normal text-foreground/60">
            No active {parentLabel} were found for this subject and class.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {strands.map((strand) => {
          const subIds = strand.sub_strands.map((subStrand) => subStrand.id);
          const selectedCount = subIds.filter((id) =>
            data.topicIds.includes(id)
          ).length;
          const allSelected =
            subIds.length > 0 && selectedCount === subIds.length;
          const partiallyChecked = selectedCount > 0 && !allSelected;

          return (
            <section
              key={strand.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1">
                <StrandToggle
                  checked={allSelected}
                  partiallyChecked={partiallyChecked}
                  disabled={subIds.length === 0}
                  label={strand.name}
                  onChange={() => toggleStrand(strand)}
                />
                <span className="text-sm font-semibold text-foreground">
                  {strand.source_code && (
                    <span className="mr-1.5 font-mono text-xs text-foreground/55">
                      {strand.source_code}
                    </span>
                  )}
                  {strand.name}
                </span>
                <span
                  className={
                    strand.verification_status === "verified_official"
                      ? "ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800"
                      : "ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800"
                  }
                >
                  {verificationLabel(strand.verification_status)}
                </span>
              </label>

              <div className="mt-2 ml-6 flex flex-col gap-1">
                {strand.sub_strands.map((subStrand) => (
                  <label
                    key={subStrand.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1 hover:bg-background/50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-accent accent-accent"
                      checked={data.topicIds.includes(subStrand.id)}
                      onChange={() => toggleTopic(subStrand.id)}
                    />
                    <span className="text-sm font-normal text-foreground">
                      {subStrand.source_code && (
                        <span className="mr-1.5 font-mono text-xs text-foreground/55">
                          {subStrand.source_code}
                        </span>
                      )}
                      {subStrand.name}
                    </span>
                  </label>
                ))}
                {strand.sub_strands.length === 0 && (
                  <p className="py-2 text-xs text-foreground/55">
                    No active {childLabel} are available under this {parentLabel.slice(0, -1)}.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
