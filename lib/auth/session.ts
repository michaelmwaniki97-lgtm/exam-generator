import "server-only";

import { cache } from "react";
import { getCurrentAuthUser } from "@/lib/auth-backend";
import { getCurrentIdentityContext } from "@/lib/identity-read";

export const getCurrentUser = getCurrentAuthUser;

export type UserRole = "admin" | "teacher";

export const getUserRole = cache(async (): Promise<UserRole | null> => {
  const context = await getCurrentIdentityContext();
  return context ? context.repository.resolveRole() : null;
});
