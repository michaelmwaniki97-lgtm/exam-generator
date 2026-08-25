"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/field-styles";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);
  return <div>
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent"><Mail size={20} aria-hidden="true" /></div>
    <h1 className="mt-5 text-2xl font-bold tracking-tight">Reset your password</h1>
    <p className="mt-2 text-sm leading-6 text-foreground/60">Enter your email and we’ll send instructions if it is associated with an account.</p>
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div><label htmlFor="email" className={labelClass}>Email</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="email" disabled={pending || Boolean(state?.success)} className={inputClass} /></div>
      {state?.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</p>}
      {state?.success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-700">{state.success}</p>}
      {!state?.success && <button type="submit" disabled={pending} className={primaryButtonClass}>{pending ? "Sending instructions…" : "Send reset instructions"}</button>}
    </form>
    <Link href="/login" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ArrowLeft size={16} aria-hidden="true" />Back to login</Link>
  </div>;
}
