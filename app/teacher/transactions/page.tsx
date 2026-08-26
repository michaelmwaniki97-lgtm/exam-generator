import { maskProviderReference } from "@/lib/payments/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIdentityReadRepository } from "@/lib/identity-read";

export default async function TeacherTransactionsPage() {
  const teacher = await (await getIdentityReadRepository()).getTeacherIdentity();
  const { data: payments } = teacher ? await createAdminClient().from("payments").select("id, amount, currency, status, mpesa_ref, created_at, completed_at, exams(exam_type)").eq("teacher_id", teacher.id).order("created_at", { ascending: false }).limit(100) : { data: [] };
  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
      {!payments?.length ? <p className="rounded-lg border border-border bg-card p-6 text-sm text-foreground/60">No payment attempts yet.</p> : <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-3">Exam</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">M-Pesa receipt</th><th className="p-3">Date</th></tr></thead><tbody>{payments.map((payment) => { const exam = payment.exams as unknown as { exam_type?: string } | null; return <tr key={payment.id} className="border-b border-border last:border-0"><td className="p-3">{exam?.exam_type ?? "Exam package"}</td><td className="p-3">{payment.currency} {payment.amount}</td><td className="p-3 capitalize">{payment.status}</td><td className="p-3">{maskProviderReference(payment.mpesa_ref) ?? "—"}</td><td className="p-3">{new Date(payment.completed_at ?? payment.created_at).toLocaleString("en-KE")}</td></tr>; })}</tbody></table></div>}
    </div>
  );
}
