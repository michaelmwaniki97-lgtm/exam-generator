import { CreditCard } from "lucide-react";
import { maskProviderReference } from "@/lib/payments/core";
import { getTeacherPaymentReportingRepository } from "@/lib/payment-reporting";

function formatAmount(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-KE")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (status === "completed" || status === "paid" || status === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "failed" || status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-800";
  }
  if (status === "pending" || status === "processing") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-border bg-background text-foreground/70";
}

export default async function TeacherTransactionsPage() {
  const payments = await (
    await getTeacherPaymentReportingRepository()
  ).listTeacherPaymentHistory();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Transactions</h2>
        <p className="mt-1 text-sm text-foreground/65">
          Payment history for your exam packages.
        </p>
      </div>

      {!payments.length ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
            <CreditCard size={23} className="text-accent" aria-hidden="true" />
          </div>
          <p className="mt-4 font-semibold text-foreground">No payment attempts yet</p>
          <p className="mt-1 max-w-sm text-sm text-foreground/65">
            Payments for exam downloads will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-5 py-3 font-semibold text-foreground/65">Exam</th>
                  <th className="px-4 py-3 font-semibold text-foreground/65">Amount</th>
                  <th className="px-4 py-3 font-semibold text-foreground/65">Status</th>
                  <th className="px-4 py-3 font-semibold text-foreground/65">M-Pesa receipt</th>
                  <th className="px-4 py-3 font-semibold text-foreground/65">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const exam = payment.exams;
                  const timestamp = payment.completed_at ?? payment.created_at;
                  return (
                    <tr key={payment.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-4 font-medium text-foreground">
                        {exam?.exam_type ? statusLabel(exam.exam_type) : "Exam package"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono font-semibold tabular-nums text-foreground">
                        {formatAmount(payment.currency, payment.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(payment.status)}`}>
                          {statusLabel(payment.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-foreground/65">
                        {maskProviderReference(payment.receiptReference) ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-foreground/65">
                        <span className="block">{formatDate(timestamp)}</span>
                        <span className="mt-0.5 block text-xs">{formatTime(timestamp)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {payments.map((payment) => {
              const exam = payment.exams;
              const timestamp = payment.completed_at ?? payment.created_at;
              return (
                <article key={payment.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {exam?.exam_type ? statusLabel(exam.exam_type) : "Exam package"}
                      </p>
                      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                        {formatAmount(payment.currency, payment.amount)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(payment.status)}`}>
                      {statusLabel(payment.status)}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t border-border pt-3 text-xs">
                    <dt className="text-foreground/55">Receipt</dt>
                    <dd className="min-w-0 truncate text-right font-mono text-foreground/70">
                      {maskProviderReference(payment.receiptReference) ?? "—"}
                    </dd>
                    <dt className="text-foreground/55">Date</dt>
                    <dd className="text-right text-foreground/70">
                      {formatDate(timestamp)} · {formatTime(timestamp)}
                    </dd>
                  </dl>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
