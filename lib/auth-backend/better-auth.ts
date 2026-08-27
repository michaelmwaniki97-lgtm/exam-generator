import "server-only";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { passwordResetPageUrl } from "../auth/recovery.ts";
import { getDatabaseBackendName } from "../db/config.ts";
import { assertPasswordResetEmailConfigured } from "../email/smtp.ts";
import {
  betterAuthApplicationIdentityWasProvisioned,
  betterAuthEmailAlreadyExists,
  betterAuthUserWasPersisted,
  provisionBetterAuthApplicationIdentity,
  removeBetterAuthSession,
  removeBetterAuthUserAfterFailedSignup,
} from "../better-auth/application-bridge.ts";
import { getBetterAuthFoundation } from "../better-auth/server.ts";
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
import { normalizeAuthenticatedUser } from "./normalize.ts";

function publicBetterAuthError(error: unknown, fallback: string): string {
  if (isAPIError(error) && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

async function compensateFailedSignup(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    await removeBetterAuthUserAfterFailedSignup(userId);
  } catch {
    // The original signup failure is more useful to the caller. Any surviving
    // row is detectable by the migration reconciliation audit before cutover.
  }
}

export async function getBetterAuthAuthenticatedUserFromHeaders(
  requestHeaders: Headers,
): Promise<AuthenticatedUser | null> {
  const auth = await getBetterAuthFoundation();
  const session = await auth.api.getSession({ headers: requestHeaders });
  return normalizeAuthenticatedUser(session?.user);
}

export async function getBetterAuthAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  return getBetterAuthAuthenticatedUserFromHeaders(await headers());
}

export async function signupWithBetterAuth(
  input: CredentialSignupInput,
): Promise<CredentialSignupResult> {
  if (getDatabaseBackendName() !== "postgres") {
    return { status: "error", error: "Better Auth signup requires the PostgreSQL backend." };
  }
  if (input.password.length < 8) {
    return { status: "error", error: "Password must be at least 8 characters long." };
  }

  try {
    if (await betterAuthEmailAlreadyExists(input.email)) {
      return { status: "error", error: "User already exists. Use another email." };
    }
  } catch {
    return { status: "error", error: "Account signup is temporarily unavailable. Please try again." };
  }

  const auth = await getBetterAuthFoundation();
  let result: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  try {
    result = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
      headers: await headers(),
    });
  } catch (error) {
    return {
      status: "error",
      error: publicBetterAuthError(error, "We could not create your account. Please try again."),
    };
  }

  const user = normalizeAuthenticatedUser(result.user);
  if (!user) {
    return { status: "error", error: "We could not verify your new account. Please try again." };
  }
  const sessionToken = typeof result.token === "string" && result.token ? result.token : null;

  // Defense-in-depth against synthetic/non-persisted signup responses: never
  // create application ownership rows until the returned UUID is confirmed in
  // Better Auth's canonical user table. An unavailable verification query is
  // ambiguous, so do not delete anything in that case.
  try {
    if (!await betterAuthUserWasPersisted(user.id, input.email)) {
      return { status: "error", error: "We could not verify your new account. Please try again." };
    }
  } catch {
    return { status: "error", error: "We could not verify your new account. Please try again later." };
  }

  const applicationEmail = user.email ?? input.email;
  try {
    await provisionBetterAuthApplicationIdentity({
      userId: user.id,
      email: applicationEmail,
      name: input.name,
      school: input.school,
      phone: input.phone,
    });
  } catch (error) {
    // A commit can succeed even if the client sees an ambiguous network error.
    // Verify the UUID + trigger-created profile before considering compensation.
    try {
      if (await betterAuthApplicationIdentityWasProvisioned(user.id, applicationEmail)) {
        return sessionToken
          ? { status: "signed-in", user }
          : { status: "confirmation-required" };
      }
    } catch {
      // State is ambiguous. Do not risk deleting a valid Better Auth credential
      // whose application identity may already have committed. Reconciliation
      // tooling can safely identify the discrepancy before cutover.
      return { status: "error", error: "We could not confirm your new account. Please try again later." };
    }

    await compensateFailedSignup(user.id);
    const duplicate = error instanceof Error && "code" in error && error.code === "23505";
    return {
      status: "error",
      error: duplicate
        ? "An account with this email already exists. Try logging in instead."
        : "We could not finish creating your account. Please try again.",
    };
  }

  return sessionToken
    ? { status: "signed-in", user }
    : { status: "confirmation-required" };
}

export async function loginWithBetterAuth(
  input: CredentialLoginInput,
): Promise<CredentialLoginResult> {
  if (getDatabaseBackendName() !== "postgres") {
    return { status: "error", error: "Better Auth login requires the PostgreSQL backend." };
  }

  const auth = await getBetterAuthFoundation();
  try {
    const result = await auth.api.signInEmail({
      body: { email: input.email, password: input.password, rememberMe: true },
      headers: await headers(),
    });
    const user = normalizeAuthenticatedUser(result.user);
    if (!user || typeof result.token !== "string" || !result.token) {
      return { status: "error", error: "We could not verify your account. Please try again." };
    }
    return { status: "signed-in", user, sessionToken: result.token };
  } catch (error) {
    return {
      status: "error",
      error: publicBetterAuthError(error, "Invalid email or password."),
    };
  }
}

export async function logoutWithBetterAuth(sessionToken?: string | null): Promise<void> {
  const auth = await getBetterAuthFoundation();

  // A just-created session is not present in the incoming request headers in the
  // same Server Action. When login discovers an unknown application profile,
  // revoke exactly that newly created token before attempting normal sign-out.
  if (sessionToken) {
    try { await removeBetterAuthSession(sessionToken); } catch { /* fail closed: role gate still denies access */ }
  }

  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Match the existing Supabase logout UX: redirect to login even when the
    // server-side revocation call cannot complete. Protected reads still fully
    // validate Better Auth sessions against the database.
  }
}

export async function requestPasswordResetWithBetterAuth(
  input: PasswordResetRequestInput,
): Promise<PasswordResetRequestResult> {
  if (getDatabaseBackendName() !== "postgres") {
    return { status: "error", error: "Better Auth password recovery requires the PostgreSQL backend." };
  }

  let redirectTo: string;
  try {
    assertPasswordResetEmailConfigured();
    redirectTo = passwordResetPageUrl(process.env);
  } catch {
    return { status: "error", error: "Password recovery is temporarily unavailable. Please try again later." };
  }

  try {
    const auth = await getBetterAuthFoundation();
    await auth.api.requestPasswordReset({
      body: { email: input.email, redirectTo },
      headers: await headers(),
    });
    return { status: "accepted" };
  } catch {
    // Do not expose whether an address exists. Configuration errors are caught
    // above; runtime endpoint errors receive the same generic UX as Supabase.
    return { status: "accepted" };
  }
}

export async function resetPasswordWithBetterAuth(
  input: PasswordResetCompletionInput,
): Promise<PasswordResetCompletionResult> {
  if (getDatabaseBackendName() !== "postgres") {
    return { status: "error", error: "Better Auth password recovery requires the PostgreSQL backend." };
  }
  if (input.newPassword.length < 8) {
    return { status: "error", error: "Password must be at least 8 characters long." };
  }
  const token = input.token?.trim() ?? "";
  if (!token || token.length > 4096) return { status: "invalid-link" };

  try {
    const auth = await getBetterAuthFoundation();
    await auth.api.resetPassword({
      body: { newPassword: input.newPassword, token },
      headers: await headers(),
    });
    return { status: "updated" };
  } catch {
    return { status: "invalid-link" };
  }
}
