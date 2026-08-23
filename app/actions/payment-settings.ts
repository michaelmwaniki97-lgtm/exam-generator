"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getUserRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateExamPackagePrice } from "@/lib/payments/core";

export type PriceActionState = { status: "success" | "error"; message: string } | undefined;

export async function updateExamPackagePrice(_state: PriceActionState, formData: FormData): Promise<PriceActionState> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || role !== "admin") return { status: "error", message: "Administrator access is required." };
  let amount: number;
  try { amount = validateExamPackagePrice(formData.get("amount")); }
  catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Enter a valid price." }; }
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert({ key: "exam_package_price", value: { amount, currency: "KES" }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { status: "error", message: "The download price could not be updated." };
  revalidatePath("/admin/settings");
  return { status: "success", message: `Exam-package price updated to KES ${amount}.` };
}
