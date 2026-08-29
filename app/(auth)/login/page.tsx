"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/field-styles";
import { PasswordInput } from "@/components/auth/password-input";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Welcome back</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Log in to your account</h1>
      <p className="mt-2 text-sm leading-6 text-foreground/65">Continue creating and reviewing your assessment documents.</p>
      <form action={formAction} className="mt-6 flex flex-col gap-4">
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
          <div className="mb-1.5 flex items-center justify-between"><label htmlFor="password" className="text-sm font-semibold text-foreground">Password</label><Link href="/forgot-password" className="inline-flex min-h-11 items-center rounded-sm text-xs font-semibold text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:min-h-0">Forgot password?</Link></div>
          <PasswordInput id="password" name="password" autoComplete="current-password" />
        </div>

        {state?.error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={`mt-2 ${primaryButtonClass}`}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm font-normal text-foreground/65">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="inline-flex min-h-11 items-center rounded-sm font-semibold text-accent hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:min-h-0">
          Sign up
        </Link>
      </p>
    </div>
  );
}
