"use client";

import { useActionState } from "react";
import { updateExamPackagePrice, type PriceActionState } from "@/app/actions/payment-settings";

export function PriceForm({ currentPrice }: { currentPrice: number }) {
  const [state, action, pending] = useActionState<PriceActionState, FormData>(updateExamPackagePrice, undefined);
  return <form action={action} className="max-w-lg rounded-lg border border-border bg-card p-6 shadow-sm">
    <h3 className="text-lg font-semibold">Exam-package download price</h3>
    <p className="mt-1 text-sm text-foreground/60">One payment unlocks both the student exam PDF and its marking scheme.</p>
    <label className="mt-5 block text-sm font-medium" htmlFor="amount">Price in KES</label>
    <input id="amount" name="amount" type="number" min="1" max="100000" step="1" required defaultValue={currentPrice} className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2"/>
    {state && <p role="status" className={`mt-3 text-sm ${state.status === "error" ? "text-red-700" : "text-green-700"}`}>{state.message}</p>}
    <button disabled={pending} className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save price"}</button>
  </form>;
}
