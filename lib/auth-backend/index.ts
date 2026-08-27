import "server-only";

import { cache } from "react";
import { getAuthBackendName } from "./config.ts";
import { getBetterAuthAuthenticatedUser } from "./better-auth.ts";
import { getSupabaseAuthenticatedUser } from "./supabase.ts";
import type { AuthenticatedUser } from "./contracts.ts";

export type * from "./contracts.ts";
export { getAuthBackendName } from "./config.ts";
export { requireSupabaseAuthForSupabaseDataApi } from "./compatibility.ts";

export const getCurrentAuthUser = cache(async (): Promise<AuthenticatedUser | null> => (
  getAuthBackendName() === "better-auth"
    ? getBetterAuthAuthenticatedUser()
    : getSupabaseAuthenticatedUser()
));
