import "server-only";

import { createClient } from "../supabase/server.ts";
import type { AuthenticatedUser } from "./contracts.ts";

export async function getSupabaseAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, email: user.email ?? null };
}
