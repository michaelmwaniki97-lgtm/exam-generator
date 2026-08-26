import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentIdentityContext } from "@/lib/identity-read";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type UserRole = "admin" | "teacher";

export const getUserRole = cache(async (): Promise<UserRole | null> => {
  const context = await getCurrentIdentityContext();
  return context ? context.repository.resolveRole() : null;
});
