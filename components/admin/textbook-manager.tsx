"use client";

import { useActionState } from "react";
import {
  createTextbookRecord,
  processTextbookDocument,
  removeTextbookDocument,
  uploadTextbookDocument,
  type TextbookActionState,
} from "@/app/actions/textbooks";

type Book = {
  id: string;
  name: string;
  publisher: string | null;
  subject: { name: string } | null;
  grade: { name: string } | null;
};

type Document = {
  id: string;
  textbook_id: string;
  original_filename: string;
  file_size: number;
  processing_status: string;
  processing_error: string | null;
  page_count: number | null;
  chunk_count: number | null;
  source_type: string;
  created_at: string;
};

type Option = { id: string; name: string };

function Message({ state }: { state: TextbookActionState }) {
  if (!state) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${
        state.status === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      {state.message}
    </p>
  );
}

function statusClass(status: string) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-800";
  if (status === "processing") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-border bg-background text-foreground/70";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const fieldClass =
  "mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

export function TextbookManager({
  books,
  documents,
  subjects,
  grades,
}: {
  books: Book[];
  documents: Document[];
  subjects: Option[];
  grades: Option[];
}) {
  const [createState, createAction, creating] = useActionState(
    createTextbookRecord,
    undefined
  );
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadTextbookDocument,
    undefined
  );
  const [processState, processAction, processing] = useActionState(
    processTextbookDocument,
    undefined
  );
  const [removeState, removeAction, removing] = useActionState(
    removeTextbookDocument,
    undefined
  );

  const documentActions = (document: Document) => (
    <div className="flex flex-wrap gap-2">
      {document.processing_status !== "processing" &&
        document.processing_status !== "ready" && (
          <form action={processAction}>
            <input type="hidden" name="documentId" value={document.id} />
            <button
              disabled={processing}
              className="inline-flex min-h-10 items-center rounded-md border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-background active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none"
            >
              {document.processing_status === "failed" ? "Retry" : "Process"}
            </button>
          </form>
        )}
      {document.processing_status !== "ready" &&
        document.processing_status !== "processing" && (
          <form action={removeAction}>
            <input type="hidden" name="documentId" value={document.id} />
            <button
              disabled={removing}
              className="inline-flex min-h-10 items-center rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none"
            >
              Remove
            </button>
          </form>
        )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <form action={createAction} className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base font-semibold text-foreground">Create textbook record</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Register the book before attaching an authorized PDF.
            </p>
          </div>
          <label className="text-sm font-semibold">
            Name/title
            <input name="name" required maxLength={180} className={fieldClass} />
          </label>
          <label className="text-sm font-semibold">
            Publisher
            <input name="publisher" maxLength={180} className={fieldClass} />
          </label>
          <label className="text-sm font-semibold">
            Grade/Form
            <select name="gradeId" required className={fieldClass}>
              <option value="">Select grade or form</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>{grade.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Subject
            <select name="subjectId" required className={fieldClass}>
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              disabled={creating}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 motion-reduce:transform-none"
            >
              {creating ? "Creating…" : "Create textbook record"}
            </button>
          </div>
          <div className="sm:col-span-2"><Message state={createState} /></div>
        </form>

        <form action={uploadAction} className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base font-semibold text-foreground">Private authorized PDF upload</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Attach a licensed PDF to an existing textbook record.
            </p>
          </div>
          <label className="text-sm font-semibold">
            Textbook record
            <select name="textbookId" required className={fieldClass}>
              <option value="">Select textbook</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.grade?.name} · {book.subject?.name} · {book.name}
                  {book.publisher ? ` (${book.publisher})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Authorized source
            <select name="sourceType" required className={fieldClass}>
              <option value="school_supplied">School supplied</option>
              <option value="publisher_authorized">Publisher authorized</option>
              <option value="oer">Licensed OER</option>
              <option value="other_authorized">Other authorized</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            PDF (maximum 12 MiB)
            <input
              name="pdf"
              type="file"
              accept="application/pdf,.pdf"
              required
              className="mt-2 block min-h-11 w-full text-sm file:mr-3 file:min-h-10 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:font-semibold"
            />
          </label>
          <label className="text-sm font-semibold">
            Authorization/license note
            <input name="authorizationNote" maxLength={500} className={fieldClass} />
          </label>
          <label className="flex min-h-11 items-start gap-3 text-sm leading-6 sm:col-span-2">
            <input
              name="authorizationAcknowledged"
              type="checkbox"
              required
              className="mt-1.5 h-5 w-5 shrink-0 accent-accent"
            />
            I confirm this private PDF was legitimately supplied or authorized for school use.
          </label>
          <div className="sm:col-span-2">
            <button
              disabled={uploading}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60 motion-reduce:transform-none"
            >
              {uploading ? "Uploading…" : "Upload privately"}
            </button>
          </div>
          <div className="sm:col-span-2"><Message state={uploadState} /></div>
        </form>
      </div>

      <Message state={processState} />
      <Message state={removeState} />

      <section aria-labelledby="documents-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="documents-heading" className="text-base font-semibold text-foreground">
            Uploaded documents
          </h2>
          <span className="font-mono text-xs tabular-nums text-foreground/55">
            {documents.length} total
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-foreground/65">
            No textbook PDFs uploaded.
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50 text-left">
                    <th className="px-4 py-3 font-semibold text-foreground/65">Textbook / file</th>
                    <th className="px-4 py-3 font-semibold text-foreground/65">Status</th>
                    <th className="px-4 py-3 font-semibold text-foreground/65">Pages / chunks</th>
                    <th className="px-4 py-3 font-semibold text-foreground/65">Source</th>
                    <th className="px-4 py-3 font-semibold text-foreground/65">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => {
                    const book = books.find((item) => item.id === document.textbook_id);
                    return (
                      <tr key={document.id} className="border-b border-border/60 align-top last:border-0">
                        <td className="max-w-xs px-4 py-4">
                          <p className="font-semibold text-foreground">{book?.name ?? "Unknown textbook"}</p>
                          <p className="mt-1 break-all text-xs text-foreground/60">
                            {document.original_filename} · {(document.file_size / 1024 / 1024).toFixed(1)} MiB
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(document.processing_status)}`}>
                            {formatStatus(document.processing_status)}
                          </span>
                          {document.processing_error && (
                            <p className="mt-2 max-w-sm text-xs leading-5 text-red-700">{document.processing_error}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono tabular-nums text-foreground/70">
                          {document.page_count ?? "—"} / {document.chunk_count ?? "—"}
                        </td>
                        <td className="px-4 py-4 capitalize text-foreground/70">
                          {document.source_type.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-3">{documentActions(document)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {documents.map((document) => {
                const book = books.find((item) => item.id === document.textbook_id);
                return (
                  <article key={document.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold text-foreground">
                          {book?.name ?? "Unknown textbook"}
                        </h3>
                        <p className="mt-1 break-all text-xs leading-5 text-foreground/60">
                          {document.original_filename} · {(document.file_size / 1024 / 1024).toFixed(1)} MiB
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(document.processing_status)}`}>
                        {formatStatus(document.processing_status)}
                      </span>
                    </div>
                    {document.processing_error && (
                      <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        {document.processing_error}
                      </p>
                    )}
                    <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
                      <dt className="text-foreground/55">Pages / chunks</dt>
                      <dd className="text-right font-mono tabular-nums text-foreground/70">
                        {document.page_count ?? "—"} / {document.chunk_count ?? "—"}
                      </dd>
                      <dt className="text-foreground/55">Source</dt>
                      <dd className="text-right capitalize text-foreground/70">
                        {document.source_type.replaceAll("_", " ")}
                      </dd>
                    </dl>
                    <div className="mt-4">{documentActions(document)}</div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
