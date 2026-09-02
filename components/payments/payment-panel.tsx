"use client";

import { useActionState } from "react";
import { CheckCircle2, Clock3, LockKeyhole, Smartphone } from "lucide-react";
import {
  checkPaymentStatusAction,
  initiatePaymentAction,
  type PaymentActionState,
} from "@/app/actions/payments";

function PaymentMessage({ state }: { state: PaymentActionState }) {
  if (!state) return null;

  const isError = state.status === "error";
  const isSuccess = state.status === "paid";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800"
          : isSuccess
            ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800"
            : "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950"
      }
    >
      <div className="flex items-start gap-2.5">
        {isSuccess ? (
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        ) : (
          <Clock3 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        )}
        <p className="text-sm font-medium leading-6">{state.message}</p>
      </div>
    </div>
  );
}

export function PaymentPanel({
  examId,
  price,
  configured,
}: {
  examId: string;
  price: number;
  configured: boolean;
}) {
  const bound = initiatePaymentAction.bind(null, examId);
  const check = checkPaymentStatusAction.bind(null, examId);
  const [state, action, pending] = useActionState<PaymentActionState, FormData>(
    bound,
    undefined
  );
  const [checkState, checkAction, checking] = useActionState<
    PaymentActionState,
    FormData
  >(check, undefined);
  const awaitingConfirmation =
    state?.status === "pending" || checkState?.status === "pending";

  return (
    <section
      aria-labelledby="payment-heading"
      className="overflow-hidden rounded-xl border border-border bg-card print:hidden"
    >
      <div className="grid gap-5 border-b border-border p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-accent">
            <LockKeyhole size={16} aria-hidden="true" />
            Exam package
          </div>
          <h3 id="payment-heading" className="mt-2 text-lg font-semibold text-foreground">
            Unlock downloads
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-foreground/65">
            One payment unlocks the student exam PDF and its marking-scheme PDF.
            After M-Pesa confirms payment, the download and print controls become
            available for this exam.
          </p>
        </div>
        <div className="rounded-lg bg-background px-4 py-3 sm:text-right">
          <p className="text-xs font-medium text-foreground/55">Amount due</p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-foreground">
            KES {price.toLocaleString("en-KE")}
          </p>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {!configured && (
          <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-950">
              M-Pesa payments are not available yet
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Provider activation is awaiting verified Daraja configuration.
            </p>
          </div>
        )}

        <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,20rem)_auto] sm:items-end">
          <label className="text-sm font-medium text-foreground" htmlFor="payment-phone">
            M-Pesa phone number
            <span className="mt-1 block text-xs font-normal text-foreground/55">
              You will receive an M-Pesa prompt on this phone.
            </span>
            <div className="relative mt-2">
              <Smartphone
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40"
                aria-hidden="true"
              />
              <input
                id="payment-phone"
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="07XXXXXXXX"
                required
                disabled={!configured}
                className="min-h-11 w-full rounded-md border border-border bg-background py-2 pl-10 pr-3 text-base outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </label>
          <button
            disabled={pending || !configured}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
          >
            {pending ? "Sending M-Pesa prompt…" : `Pay KES ${price.toLocaleString("en-KE")}`}
          </button>
        </form>

        {(pending || checking) && (
          <p role="status" className="mt-4 text-sm font-medium text-foreground/65">
            {pending ? "Starting the payment request…" : "Checking M-Pesa confirmation…"}
          </p>
        )}

        <div className="mt-4 grid gap-3">
          <PaymentMessage state={state} />
          <PaymentMessage state={checkState} />
        </div>

        {awaitingConfirmation && (
          <form action={checkAction} className="mt-4">
            <button
              disabled={checking}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/40 hover:bg-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
            >
              {checking ? "Checking confirmation…" : "Check payment status"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
