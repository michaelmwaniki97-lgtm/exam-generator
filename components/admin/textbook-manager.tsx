"use client";
import { useActionState } from "react";
import { processTextbookDocument, removeTextbookDocument, uploadTextbookDocument, type TextbookActionState } from "@/app/actions/textbooks";

type Book = { id: string; name: string; publisher: string | null; subject: { name: string } | null; grade: { name: string } | null };
type Document = { id: string; textbook_id: string; original_filename: string; file_size: number; processing_status: string; processing_error: string | null; page_count: number | null; chunk_count: number | null; source_type: string; created_at: string };
function Message({ state }: { state: TextbookActionState }) { return state ? <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${state.status === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>{state.message}</p> : null; }

export function TextbookManager({ books, documents }: { books: Book[]; documents: Document[] }) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadTextbookDocument, undefined);
  const [processState, processAction, processing] = useActionState(processTextbookDocument, undefined);
  const [removeState, removeAction, removing] = useActionState(removeTextbookDocument, undefined);
  return <div className="flex flex-col gap-6">
    <form action={uploadAction} className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
      <h2 className="sm:col-span-2 text-lg font-bold">Private authorized PDF upload</h2>
      <label className="text-sm font-semibold">Textbook record<select name="textbookId" required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"><option value="">Select textbook</option>{books.map((book) => <option key={book.id} value={book.id}>{book.grade?.name} · {book.subject?.name} · {book.name}{book.publisher ? ` (${book.publisher})` : ""}</option>)}</select></label>
      <label className="text-sm font-semibold">Authorized source<select name="sourceType" required className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"><option value="school_supplied">School supplied</option><option value="publisher_authorized">Publisher authorized</option><option value="oer">Licensed OER</option><option value="other_authorized">Other authorized</option></select></label>
      <label className="text-sm font-semibold">PDF (maximum 12 MiB)<input name="pdf" type="file" accept="application/pdf,.pdf" required className="mt-1 block w-full text-sm" /></label>
      <label className="text-sm font-semibold">Authorization/license note<input name="authorizationNote" maxLength={500} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
      <label className="sm:col-span-2 flex gap-2 text-sm"><input name="authorizationAcknowledged" type="checkbox" required />I confirm this private PDF was legitimately supplied or authorized for school use.</label>
      <div className="sm:col-span-2"><button disabled={uploading} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{uploading ? "Uploading…" : "Upload privately"}</button></div>
      <div className="sm:col-span-2"><Message state={uploadState} /></div>
    </form>
    <Message state={processState} /><Message state={removeState} />
    <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="p-3">Textbook / file</th><th className="p-3">Status</th><th className="p-3">Pages / chunks</th><th className="p-3">Source</th><th className="p-3">Actions</th></tr></thead><tbody>{documents.map((document) => { const book = books.find((item) => item.id === document.textbook_id); return <tr key={document.id} className="border-b border-border/60 align-top"><td className="p-3"><p className="font-semibold">{book?.name ?? "Unknown textbook"}</p><p className="text-foreground/60">{document.original_filename} · {(document.file_size / 1024 / 1024).toFixed(1)} MiB</p></td><td className="p-3"><span className="font-semibold capitalize">{document.processing_status}</span>{document.processing_error && <p className="mt-1 max-w-sm text-red-700">{document.processing_error}</p>}</td><td className="p-3">{document.page_count ?? "—"} / {document.chunk_count ?? "—"}</td><td className="p-3">{document.source_type.replaceAll("_", " ")}</td><td className="p-3"><div className="flex gap-2">{document.processing_status !== "processing" && document.processing_status !== "ready" && <form action={processAction}><input type="hidden" name="documentId" value={document.id} /><button disabled={processing} className="rounded border border-border px-3 py-1.5 font-semibold">{document.processing_status === "failed" ? "Retry" : "Process"}</button></form>}{document.processing_status !== "ready" && document.processing_status !== "processing" && <form action={removeAction}><input type="hidden" name="documentId" value={document.id} /><button disabled={removing} className="rounded border border-red-200 px-3 py-1.5 font-semibold text-red-700">Remove</button></form>}</div></td></tr>; })}{documents.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-foreground/60">No textbook PDFs uploaded.</td></tr>}</tbody></table></div>
  </div>;
}
