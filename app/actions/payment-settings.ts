"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getUserRole } from "@/lib/auth/session";
import { validateExamPackagePrice } from "@/lib/payments/core";
import { getAppSettingsWriteRepository } from "@/lib/app-settings-write";

export type PriceActionState = { status: "success" | "error"; message: string } | undefined;

export async function updateExamPackagePrice(_state: PriceActionState, formData: FormData): Promise<PriceActionState> {
  const [user, role] = await Promise.all([getCurrentUser(), getUserRole()]);
  if (!user || role !== "admin") return { status: "error", message: "Administrator access is required." };
  let amount: number;
  try { amount = validateExamPackagePrice(formData.get("amount")); }
  catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Enter a valid price." }; }
  try {
    await (await getAppSettingsWriteRepository()).upsertExamPackagePrice(
      amount,
      new Date().toISOString()
    );
  } catch { return { status: "error", message: "The download price could not be updated." }; }
  revalidatePath("/admin/settings");
  return { status: "success", message: `Exam-package price updated to KES ${amount}.` };
}
