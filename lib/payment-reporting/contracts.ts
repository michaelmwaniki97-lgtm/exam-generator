export type TeacherPaymentHistoryRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receiptReference: string | null;
  created_at: string;
  completed_at: string | null;
  exams: { exam_type: string } | null;
};

export interface TeacherPaymentReportingRepository {
  listTeacherPaymentHistory(): Promise<TeacherPaymentHistoryRow[]>;
}

export interface AdminPaymentReportingRepository {
  getAdminPaidRevenue(): Promise<number>;
}

export function wholeKesTotal(values: Array<number | string>): number {
  let total = BigInt(0);
  for (const value of values) {
    const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : typeof value === "string" && /^\d+$/.test(value) ? value : null;
    if (text === null) throw new Error("Payment reporting returned an invalid whole-KES amount.");
    total += BigInt(text);
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Payment reporting total exceeds the safe display range.");
  return Number(total);
}
