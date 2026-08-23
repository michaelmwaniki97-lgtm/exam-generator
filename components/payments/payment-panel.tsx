"use client";

import { useActionState } from "react";
import { initiatePaymentAction, type PaymentActionState } from "@/app/actions/payments";

export function PaymentPanel({ examId, price, configured }: { examId: string; price: number; configured: boolean }) {
  const bound = initiatePaymentAction.bind(null, examId);
  const [state, action, pending] = useActionState<PaymentActionState, FormData>(bound, undefined);
  return <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 print:hidden">
    <h3 className="font-semibold">Unlock exam package — KES {price}</h3>
    <p className="mt-1 text-sm">One payment unlocks both the student PDF and the marking-scheme PDF.</p>
    {!configured && <p className="mt-3 text-sm">M-Pesa provider activation is awaiting verified Daraja configuration.</p>}
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm"><span className="block font-medium">M-Pesa phone</span><input name="phone" inputMode="tel" autoComplete="tel" placeholder="07XXXXXXXX" required disabled={!configured} className="mt-1 rounded-md border border-amber-400 bg-white px-3 py-2 disabled:opacity-60"/></label>
      <button disabled={pending || !configured} className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Starting…" : "Pay with M-Pesa"}</button>
    </form>
    {state && <p role="status" className="mt-3 text-sm">{state.message}</p>}
    <p className="mt-3 text-xs text-amber-800">The preview remains available for review. Screenshots cannot be technically prevented.</p>
  </section>;
}
