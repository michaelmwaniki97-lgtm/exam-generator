"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/field-styles";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Log in</h1>
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
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            className={inputClass}
          />
        </div>

        {state?.error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={`mt-2 ${primaryButtonClass}`}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm font-normal text-foreground/60">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-accent hover:text-accent-hover">
          Sign up
        </Link>
      </p>
    </div>
  );
}
