"use client";

import { useActionState } from "react";
import { Mail, Save, School, UserRound } from "lucide-react";
import { updateTeacherProfile } from "@/app/actions/auth";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/field-styles";

export function ProfileForm({ email, name, school, phone }: { email: string; name: string; school: string; phone: string }) {
  const [state, formAction, pending] = useActionState(updateTeacherProfile, undefined);

  return (
    <form action={formAction} className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
          <UserRound size={21} aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Teacher details</h3>
          <p className="text-sm text-foreground/60">Your email is managed by your login account.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="email" className={labelClass}>Email address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={17} aria-hidden="true" />
            <input id="email" value={email} disabled className={`${inputClass} pl-10 disabled:cursor-not-allowed disabled:bg-background disabled:text-foreground/60`} />
          </div>
        </div>
        <div>
          <label htmlFor="name" className={labelClass}>Full name</label>
          <input id="name" name="name" defaultValue={name} required minLength={2} maxLength={100} autoComplete="name" className={inputClass} />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>Phone number</label>
          <input id="phone" name="phone" type="tel" defaultValue={phone} maxLength={30} autoComplete="tel" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="school" className={labelClass}>School</label>
          <div className="relative">
            <School className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={17} aria-hidden="true" />
            <input id="school" name="school" defaultValue={school} maxLength={160} autoComplete="organization" className={`${inputClass} pl-10`} />
          </div>
        </div>
      </div>

      {state?.error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</p>}
      {state?.success && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{state.success}</p>}

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={pending} className={`${primaryButtonClass} inline-flex items-center gap-2`}>
          <Save size={16} aria-hidden="true" />
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
