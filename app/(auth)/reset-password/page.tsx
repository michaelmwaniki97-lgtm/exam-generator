import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { cookies } from "next/headers";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const cookieStore = await cookies();
  return <ResetPasswordForm invalidLink={error === "invalid_link" || cookieStore.get("auth-recovery")?.value !== "active"} />;
}
