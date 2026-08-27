import "server-only";

import { cache } from "react";
import { getAuthBackendName } from "./config.ts";
import { AUTH_CUTOVER_FROZEN_MESSAGE, isAuthMutationFrozen } from "./cutover-mode.ts";
import {
  getBetterAuthAuthenticatedUser,
  loginWithBetterAuth,
  logoutWithBetterAuth,
  requestPasswordResetWithBetterAuth,
  resetPasswordWithBetterAuth,
  signupWithBetterAuth,
} from "./better-auth.ts";
import {
  getSupabaseAuthenticatedUser,
  loginWithSupabase,
  logoutWithSupabase,
  requestPasswordResetWithSupabase,
  resetPasswordWithSupabase,
  signupWithSupabase,
} from "./supabase.ts";
import type {
  AuthenticatedUser,
  CredentialLoginInput,
  CredentialLoginResult,
  CredentialSignupInput,
  CredentialSignupResult,
  PasswordResetCompletionInput,
  PasswordResetCompletionResult,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
} from "./contracts.ts";

export type * from "./contracts.ts";
export { getAuthBackendName } from "./config.ts";
export { getAuthMutationMode, isAuthMutationFrozen } from "./cutover-mode.ts";
export { requireSupabaseAuthForSupabaseDataApi } from "./compatibility.ts";

export const getCurrentAuthUser = cache(async (): Promise<AuthenticatedUser | null> => (
  getAuthBackendName() === "better-auth"
    ? getBetterAuthAuthenticatedUser()
    : getSupabaseAuthenticatedUser()
));

export function signupWithConfiguredBackend(
  input: CredentialSignupInput,
): Promise<CredentialSignupResult> {
  if (isAuthMutationFrozen()) {
    return Promise.resolve({ status: "error", error: AUTH_CUTOVER_FROZEN_MESSAGE });
  }
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

export function requestPasswordResetWithConfiguredBackend(
  input: PasswordResetRequestInput,
): Promise<PasswordResetRequestResult> {
  if (isAuthMutationFrozen()) {
    return Promise.resolve({ status: "error", error: AUTH_CUTOVER_FROZEN_MESSAGE });
  }
  return getAuthBackendName() === "better-auth"
    ? requestPasswordResetWithBetterAuth(input)
    : requestPasswordResetWithSupabase(input);
}

export function resetPasswordWithConfiguredBackend(
  input: PasswordResetCompletionInput,
): Promise<PasswordResetCompletionResult> {
  if (isAuthMutationFrozen()) {
    return Promise.resolve({ status: "error", error: AUTH_CUTOVER_FROZEN_MESSAGE });
  }
  return getAuthBackendName() === "better-auth"
    ? resetPasswordWithBetterAuth(input)
    : resetPasswordWithSupabase(input);
}
