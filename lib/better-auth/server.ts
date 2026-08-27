import "server-only";

import { getAuthBackendName } from "../auth-backend/config.ts";
import { buildBetterAuthOptions } from "./options.ts";

export type BetterAuthFoundationInstance = {
  handler(request: Request): Promise<Response> | Response;
};

type BetterAuthModule = {
  betterAuth(options: ReturnType<typeof buildBetterAuthOptions>): BetterAuthFoundationInstance;
};

let instancePromise: Promise<BetterAuthFoundationInstance> | undefined;

async function loadBetterAuthModule(): Promise<BetterAuthModule> {
  // Keep the Phase-1 foundation inert under the Supabase default. The package
  // is loaded only when AUTH_BACKEND=better-auth is explicitly selected.
  const packageName = "better-auth";
  try {
    return await import(packageName) as BetterAuthModule;
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
