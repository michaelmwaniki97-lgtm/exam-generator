"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserRoleForAuthenticatedUser } from "@/lib/auth/session";
import {
  loginWithConfiguredBackend,
  logoutWithConfiguredBackend,
  signupWithConfiguredBackend,
} from "@/lib/auth-backend";
import { homeForRole } from "@/lib/auth/access";
import {
  validateLoginFields,
  validateNewPassword,
  validateRecoveryEmail,
  validateSignupFields,
} from "@/lib/auth/validation";
import { recoveryRedirectUrl } from "@/lib/auth/recovery";
import { getTeacherProfileWriteContext } from "@/lib/teacher-profile-write";

export type AuthFormState = { error?: string; success?: string } | undefined;
export type ProfileFormState = { error?: string; success?: string } | undefined;

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const school = String(formData.get("school") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const validationError = validateSignupFields({ name, email, password, school, phone });
  if (validationError) {
    return { error: validationError };
  }

  const result = await signupWithConfiguredBackend({ name, email, password, school, phone });
  if (result.status === "error") {
    return { error: result.error };
  }
  if (result.status === "confirmation-required") {
    return { success: "Account created. Check your email to confirm your address, then log in." };
  }

  redirect("/teacher/dashboard");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const validationError = validateLoginFields({ email, password });
  if (validationError) {
    return { error: validationError };
  }

  const result = await loginWithConfiguredBackend({ email, password });
  if (result.status === "error") {
    return { error: result.error };
  }

  const role = await getUserRoleForAuthenticatedUser(result.user);
  if (!role) {
    await logoutWithConfiguredBackend(result.sessionToken);
    return { error: "Your account does not have an application profile. Contact an administrator." };
  }

  redirect(homeForRole(role));
}

export async function logout() {
  await logoutWithConfiguredBackend();
  redirect("/login");
}

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const validationError = validateRecoveryEmail(email);
  if (validationError) return { error: validationError };

  let redirectTo: string;
  try { redirectTo = recoveryRedirectUrl(process.env); }
  catch { return { error: "Password recovery is temporarily unavailable. Please try again later." }; }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { success: "If an account exists for that email, we’ve sent password reset instructions." };
}

export async function resetPassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");
  const validationError = validateNewPassword(password, confirmation);
  if (validationError) return { error: validationError };

  const cookieStore = await cookies();
  if (cookieStore.get("auth-recovery")?.value !== "active") return { error: "This password reset link is invalid or has expired. Request a new one." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "This password reset link is invalid or has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We could not update your password. The reset link may have expired." };
  await supabase.auth.signOut();
  cookieStore.delete("auth-recovery");
  return { success: "Your password has been updated. You can now log in with your new password." };
}

export async function updateTeacherProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 2) return { error: "Please enter your full name." };
  if (name.length > 100 || school.length > 160 || phone.length > 30) {
    return { error: "One or more fields are too long." };
  }

  const context = await getTeacherProfileWriteContext();
  if (context.status === "unauthenticated") {
    return { error: "Your session has expired. Please log in again." };
  }
  if (context.status === "forbidden") {
    return { error: "Only teacher profiles can be updated here." };
  }

  try {
    await context.repository.updateProfile({
      name,
      school: school || null,
      phone: phone || null,
    });
  } catch { return { error: "Could not update your profile. Please try again." }; }
  return { success: "Profile updated successfully." };
}
