import "server-only";

import { cache } from "react";
import { getCurrentAuthUser, type AuthenticatedUser } from "@/lib/auth-backend";
import { getCurrentIdentityContext, getIdentityReadRepositoryForAuthenticatedUser } from "@/lib/identity-read";

export const getCurrentUser = getCurrentAuthUser;

export type UserRole = "admin" | "teacher";

export const getUserRole = cache(async (): Promise<UserRole | null> => {
  const context = await getCurrentIdentityContext();
  return context ? context.repository.resolveRole() : null;
});

/** Resolve a role for a user returned directly by a successful auth mutation. */
export async function getUserRoleForAuthenticatedUser(
  user: AuthenticatedUser,
): Promise<UserRole | null> {
  const repository = await getIdentityReadRepositoryForAuthenticatedUser(user);
  return repository.resolveRole();
}
