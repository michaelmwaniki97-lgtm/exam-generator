import "server-only";

import { getAuthBackendName } from "../auth-backend/config.ts";
import { buildBetterAuthOptions } from "./options.ts";

export type BetterAuthCredentialResult = {
  token: string | null;
  user: { id: string; email?: string | null };
};

export type BetterAuthSessionResult = {
  user: { id: string; email?: string | null };
  session: { id: string; expiresAt: Date | string };
} | null;

export type BetterAuthFoundationInstance = {
  handler(request: Request): Promise<Response> | Response;
  api: {
    getSession(input: { headers: Headers }): Promise<BetterAuthSessionResult>;
    signUpEmail(input: {
      body: { name: string; email: string; password: string };
      headers?: Headers;
    }): Promise<BetterAuthCredentialResult>;
    signInEmail(input: {
      body: { email: string; password: string; rememberMe?: boolean };
      headers?: Headers;
    }): Promise<BetterAuthCredentialResult & { token: string }>;
    signOut(input: { headers: Headers }): Promise<unknown>;
    requestPasswordReset(input: {
      body: { email: string; redirectTo: string };
      headers?: Headers;
    }): Promise<unknown>;
    resetPassword(input: {
      body: { newPassword: string; token: string };
      headers?: Headers;
    }): Promise<unknown>;
  };
};

type BetterAuthModule = {
  betterAuth(options: ReturnType<typeof buildBetterAuthOptions>): BetterAuthFoundationInstance;
};

let instancePromise: Promise<BetterAuthFoundationInstance> | undefined;

async function loadBetterAuthModule(): Promise<BetterAuthModule> {
  // Keep configuration/database initialization inert on the explicit legacy
  // Supabase path. Development selects Better Auth by default; production must
  // always declare its backend explicitly.
  try {
    return await import("better-auth") as BetterAuthModule;
  } catch {
    throw new Error(
      "Better Auth runtime is not installed. Install the reviewed better-auth dependency before enabling AUTH_BACKEND=better-auth.",
    );
  }
}

export async function getBetterAuthFoundation(): Promise<BetterAuthFoundationInstance> {
  if (getAuthBackendName() !== "better-auth") {
    throw new Error("Better Auth foundation is disabled while AUTH_BACKEND=supabase.");
  }
  if (!instancePromise) {
    instancePromise = loadBetterAuthModule().then(({ betterAuth }) => betterAuth(buildBetterAuthOptions()));
  }
  return instancePromise;
}
