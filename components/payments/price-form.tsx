"use client";

import { useActionState } from "react";
import {
  updateExamPackagePrice,
  type PriceActionState,
} from "@/app/actions/payment-settings";

export function PriceForm({ currentPrice }: { currentPrice: number }) {
  const [state, action, pending] = useActionState<PriceActionState, FormData>(
    updateExamPackagePrice,
    undefined
  );

  return (
    <form action={action} className="max-w-2xl rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <h3 className="font-semibold text-foreground">Exam package price</h3>
        <p className="mt-1 text-sm leading-6 text-foreground/65">
          This amount unlocks both the student exam PDF and its marking scheme.
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <label className="block text-sm font-medium text-foreground" htmlFor="amount">
          Download price
        </label>
        <div className="mt-2 flex max-w-sm overflow-hidden rounded-md border border-border bg-background transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
          <span className="flex min-h-11 items-center border-r border-border px-3 text-sm font-semibold text-foreground/60">
            KES
          </span>
          <input
            id="amount"
            name="amount"
            type="number"
            min="1"
            max="100000"
            step="1"
            required
            defaultValue={currentPrice}
            className="min-h-11 min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-base tabular-nums text-foreground outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-foreground/55">
          Enter a whole amount between KES 1 and KES 100,000.
        </p>

        {state && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
              state.status === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {state.message}
          </p>
        )}

        <button
          disabled={pending}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
        >
          {pending ? "Saving price…" : "Save price"}
        </button>
      </div>
    </form>
  );
}
