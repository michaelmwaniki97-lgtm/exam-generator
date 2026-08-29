"use client";

import { useActionState, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  createGrade,
  createSubject,
  deleteGrade,
  deleteSubject,
  updateGrade,
  updateSubject,
  type AdminActionState,
} from "@/app/actions/admin";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
} from "@/components/ui/field-styles";

export type CatalogItem = {
  id: string;
  name: string;
  level?: string;
};

type CatalogMode = "subjects" | "grades";

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

function CreateCatalogItem({
  mode,
  levels,
}: {
  mode: CatalogMode;
  levels: string[];
}) {
  const action = mode === "subjects" ? createSubject : createGrade;
  const [state, formAction, pending] = useActionState(action, undefined);
  const isGrade = mode === "grades";

  return (
    <form
      action={formAction}
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Plus size={18} className="text-accent" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">
          Add {isGrade ? "grade or class" : "subject"}
        </h3>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className={isGrade ? "" : "sm:col-span-2"}>
          <label htmlFor={"new-" + mode + "-name"} className={labelClass}>
            {isGrade ? "Grade or class name" : "Subject name"}
          </label>
          <input
            id={"new-" + mode + "-name"}
            name="name"
            required
            maxLength={isGrade ? 80 : 120}
            className={inputClass}
            placeholder={isGrade ? "Enter existing official class label" : "Enter subject name"}
          />
        </div>
        {isGrade && (
          <div>
            <label htmlFor="new-grade-level" className={labelClass}>
              Education level
            </label>
            <input
              id="new-grade-level"
              name="level"
              required
              maxLength={80}
              list="existing-education-levels"
              className={inputClass}
              placeholder="e.g. Junior School"
            />
            <datalist id="existing-education-levels">
              {levels.map((level) => (
                <option value={level} key={level} />
              ))}
            </datalist>
          </div>
        )}
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          <Plus size={16} aria-hidden="true" />
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

function CatalogRow({ item, mode }: { item: CatalogItem; mode: CatalogMode }) {
  const updateAction = mode === "subjects" ? updateSubject : updateGrade;
  const deleteAction = mode === "subjects" ? deleteSubject : deleteGrade;
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateAction,
    undefined
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    undefined
  );
  const isGrade = mode === "grades";

  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{item.name}</h3>
          {item.level && (
            <p className="mt-1 text-sm text-foreground/65">{item.level}</p>
          )}
        </div>
      </div>

      <details className="mt-4 border-t border-border pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-accent">
          <Pencil size={15} aria-hidden="true" />
          Edit details
        </summary>
        <form action={updateFormAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={item.id} />
          <div className={isGrade ? "" : "sm:col-span-2"}>
            <label htmlFor={"name-" + item.id} className={labelClass}>
              {isGrade ? "Grade or class name" : "Subject name"}
            </label>
            <input
              id={"name-" + item.id}
              name="name"
              required
              maxLength={isGrade ? 80 : 120}
              defaultValue={item.name}
              className={inputClass}
            />
          </div>
          {isGrade && (
            <div>
              <label htmlFor={"level-" + item.id} className={labelClass}>
                Education level
              </label>
              <input
                id={"level-" + item.id}
                name="level"
                required
                maxLength={80}
                defaultValue={item.level}
                className={inputClass}
              />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={updatePending}
              className={primaryButtonClass}
            >
              {updatePending ? "Saving…" : "Save changes"}
            </button>
          </div>
          <div className="sm:col-span-2">
            <Feedback state={updateState} />
          </div>
        </form>
      </details>

      <form
        action={deleteFormAction}
        className="mt-4"
        onSubmit={(event) => {
          if (
            !window.confirm(
              "Delete " +
                item.name +
                "? This is allowed only when no curriculum, textbook, or exam records depend on it."
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={item.id} />
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
    </article>
  );
}

export function CatalogManager({
  mode,
  items,
}: {
  mode: CatalogMode;
  items: CatalogItem[];
}) {
  const [query, setQuery] = useState("");
  const levels = useMemo(
    () =>
      [...new Set(items.map((item) => item.level).filter((level): level is string => Boolean(level)))].sort(),
    [items]
  );
  const filteredItems = useMemo(() => {
    const key = query.trim().toLocaleLowerCase("en");
    if (!key) return items;
    return items.filter((item) =>
      [item.name, item.level ?? ""].some((value) =>
        value.toLocaleLowerCase("en").includes(key)
      )
    );
  }, [items, query]);

  return (
    <div className="flex flex-col gap-6">
      <CreateCatalogItem mode={mode} levels={levels} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground/65">
          {filteredItems.length} of {items.length} records
        </p>
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">
            Search {mode === "subjects" ? "subjects" : "grades and classes"}
          </span>
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass + " pl-10"}
            placeholder={
              mode === "subjects" ? "Search subjects…" : "Search grades or education levels…"
            }
          />
        </label>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-semibold text-foreground">No matching records</p>
          <p className="mt-1 text-sm text-foreground/65">
            Try a different search or add a new record above.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredItems.map((item) => (
            <CatalogRow key={item.id} item={item} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}
