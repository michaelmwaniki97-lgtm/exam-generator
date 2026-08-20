"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/field-styles";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Create a teacher account</h1>
      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <div>
          <label htmlFor="name" className={labelClass}>
            Full name
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="school" className={labelClass}>
            School
          </label>
          <input
            id="school"
            name="school"
            maxLength={160}
            autoComplete="organization"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={30}
            autoComplete="tel"
            className={inputClass}
          />
        </div>

        {state?.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}

        {state?.success && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {state.success}
          </p>
        )}

        <button type="submit" disabled={pending} className={`mt-2 ${primaryButtonClass}`}>
          {pending ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-sm font-normal text-foreground/60">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent hover:text-accent-hover">
          Log in
        </Link>
      </p>
    </div>
  );
}
