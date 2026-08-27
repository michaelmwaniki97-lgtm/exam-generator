import "server-only";

import { cache } from "react";
import { getAuthBackendName } from "./config.ts";
import {
  getBetterAuthAuthenticatedUser,
  loginWithBetterAuth,
  logoutWithBetterAuth,
  signupWithBetterAuth,
} from "./better-auth.ts";
import {
  getSupabaseAuthenticatedUser,
  loginWithSupabase,
  logoutWithSupabase,
  signupWithSupabase,
} from "./supabase.ts";
import type {
  AuthenticatedUser,
  CredentialLoginInput,
  CredentialLoginResult,
  CredentialSignupInput,
  CredentialSignupResult,
} from "./contracts.ts";

export type * from "./contracts.ts";
export { getAuthBackendName } from "./config.ts";
export { requireSupabaseAuthForSupabaseDataApi } from "./compatibility.ts";

export const getCurrentAuthUser = cache(async (): Promise<AuthenticatedUser | null> => (
  getAuthBackendName() === "better-auth"
    ? getBetterAuthAuthenticatedUser()
    : getSupabaseAuthenticatedUser()
));

export function signupWithConfiguredBackend(
  input: CredentialSignupInput,
): Promise<CredentialSignupResult> {
  return getAuthBackendName() === "better-auth"
    ? signupWithBetterAuth(input)
    : signupWithSupabase(input);
}

export function loginWithConfiguredBackend(
  input: CredentialLoginInput,
): Promise<CredentialLoginResult> {
  return getAuthBackendName() === "better-auth"
    ? loginWithBetterAuth(input)
    : loginWithSupabase(input);
}

export function logoutWithConfiguredBackend(sessionToken?: string | null): Promise<void> {
  return getAuthBackendName() === "better-auth"
    ? logoutWithBetterAuth(sessionToken)
    : logoutWithSupabase();
}
