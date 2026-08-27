"use server";

import { redirect } from "next/navigation";
import { getUserRoleForAuthenticatedUser } from "@/lib/auth/session";
import {
  loginWithConfiguredBackend,
  logoutWithConfiguredBackend,
  requestPasswordResetWithConfiguredBackend,
  resetPasswordWithConfiguredBackend,
  signupWithConfiguredBackend,
} from "@/lib/auth-backend";
import { homeForRole } from "@/lib/auth/access";
import {
  validateLoginFields,
  validateNewPassword,
  validateRecoveryEmail,
  validateSignupFields,
} from "@/lib/auth/validation";
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

  const result = await requestPasswordResetWithConfiguredBackend({ email });
  if (result.status === "error") return { error: result.error };
  return { success: "If an account exists for that email, we’ve sent password reset instructions." };
}

export async function resetPassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");
  const tokenValue = String(formData.get("resetToken") ?? "").trim();
  const validationError = validateNewPassword(password, confirmation);
  if (validationError) return { error: validationError };

  const result = await resetPasswordWithConfiguredBackend({
    newPassword: password,
    token: tokenValue || null,
  });
  if (result.status === "invalid-link") {
    return { error: "This password reset link is invalid or has expired. Request a new one." };
  }
  if (result.status === "error") return { error: result.error };
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
