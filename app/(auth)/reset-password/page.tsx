import { cookies } from "next/headers";
import { getAuthBackendName } from "@/lib/auth-backend/config";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; token?: string }>;
}) {
  const { error, token } = await searchParams;
  const backend = getAuthBackendName();

  if (backend === "better-auth") {
    const invalidLink = error === "INVALID_TOKEN" || error === "invalid_link" || !token;
    return <ResetPasswordForm invalidLink={invalidLink} resetToken={token ?? null} minimumPasswordLength={8} />;
  }

  const cookieStore = await cookies();
  return (
    <ResetPasswordForm
      invalidLink={error === "invalid_link" || cookieStore.get("auth-recovery")?.value !== "active"}
      resetToken={null}
      minimumPasswordLength={6}
    />
  );
}
