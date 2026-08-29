import { maskProviderReference } from "@/lib/payments/core";
import { getTeacherPaymentReportingRepository } from "@/lib/payment-reporting";

export default async function TeacherTransactionsPage() {
  const payments = await (await getTeacherPaymentReportingRepository()).listTeacherPaymentHistory();
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
      {!payments.length ? <p className="rounded-lg border border-border bg-card p-6 text-sm text-foreground/65">No payment attempts yet.</p> : <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-3">Exam</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">M-Pesa receipt</th><th className="p-3">Date</th></tr></thead><tbody>{payments.map((payment) => { const exam = payment.exams; return <tr key={payment.id} className="border-b border-border last:border-0"><td className="p-3">{exam?.exam_type ?? "Exam package"}</td><td className="p-3">{payment.currency} {payment.amount}</td><td className="p-3 capitalize">{payment.status}</td><td className="p-3">{maskProviderReference(payment.receiptReference) ?? "—"}</td><td className="p-3">{new Date(payment.completed_at ?? payment.created_at).toLocaleString("en-KE")}</td></tr>; })}</tbody></table></div>}
    </div>
  );
}
