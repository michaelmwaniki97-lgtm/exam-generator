import "server-only";

import { createClient } from "../supabase/server.ts";
import type {
  AuthenticatedUser,
  CredentialLoginInput,
  CredentialLoginResult,
  CredentialSignupInput,
  CredentialSignupResult,
} from "./contracts.ts";
import { normalizeAuthenticatedUser } from "./normalize.ts";

export async function getSupabaseAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? null };
}

export async function signupWithSupabase(
  input: CredentialSignupInput,
): Promise<CredentialSignupResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { name: input.name, school: input.school, phone: input.phone },
    },
  });

  if (error) return { status: "error", error: error.message };
  if (!data.session) return { status: "confirmation-required" };

  const user = normalizeAuthenticatedUser(data.user);
  if (!user) return { status: "error", error: "We could not create your session. Please try logging in." };
  return { status: "signed-in", user };
}

export async function loginWithSupabase(
  input: CredentialLoginInput,
): Promise<CredentialLoginResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(input);
  if (error) return { status: "error", error: error.message };

  const user = normalizeAuthenticatedUser(data.user);
  if (!user) return { status: "error", error: "We could not verify your account. Please try again." };
  return { status: "signed-in", user, sessionToken: null };
}

export async function logoutWithSupabase(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
