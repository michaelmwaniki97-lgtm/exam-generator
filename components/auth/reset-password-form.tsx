"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { labelClass, primaryButtonClass } from "@/components/ui/field-styles";

export function ResetPasswordForm({ invalidLink }: { invalidLink: boolean }) {
  const [state, formAction, pending] = useActionState(resetPassword, undefined);
  const unavailable = invalidLink && !state?.success;
  return <div>
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent"><KeyRound size={20} aria-hidden="true" /></div>
    <h1 className="mt-5 text-2xl font-bold tracking-tight">Choose a new password</h1>
    <p className="mt-2 text-sm leading-6 text-foreground/60">Use at least 6 characters and choose a password you do not use elsewhere.</p>
    {unavailable ? <div className="mt-6"><p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-800">This password reset link is invalid or has expired. Request a new one to continue.</p><Link href="/forgot-password" className={`mt-5 ${primaryButtonClass}`}>Request a new link</Link></div> : state?.success ? <div className="mt-6"><p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-700">{state.success}</p><Link href="/login" className={`mt-5 ${primaryButtonClass}`}>Continue to login</Link></div> : <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div><label htmlFor="password" className={labelClass}>New password</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={6} /></div>
      <div><label htmlFor="confirmPassword" className={labelClass}>Confirm new password</label><PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={6} /></div>
      {state?.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={primaryButtonClass}>{pending ? "Updating password…" : "Update password"}</button>
    </form>}
    <p className="mt-6 text-sm text-foreground/60">Remembered your password? <Link href="/login" className="font-semibold text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Log in</Link></p>
  </div>;
}
