"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/access";
import {
  validateLoginFields,
  validateSignupFields,
} from "@/lib/auth/validation";

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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, school, phone },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const role = await getUserRole();
  if (!role) {
    await supabase.auth.signOut();
    return { error: "Your account does not have an application profile. Contact an administrator." };
  }

  redirect(homeForRole(role));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please log in again." };

  const role = await getUserRole();
  if (role !== "teacher") return { error: "Only teacher profiles can be updated here." };

  const { error } = await supabase
    .from("teachers")
    .update({ name, school: school || null, phone: phone || null })
    .eq("user_id", user.id);

  if (error) return { error: "Could not update your profile. Please try again." };
  return { success: "Profile updated successfully." };
}
