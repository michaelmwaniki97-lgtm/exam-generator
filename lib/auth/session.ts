import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type UserRole = "admin" | "teacher";

export const getUserRole = cache(async (): Promise<UserRole | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: adminRow }, { data: teacherRow }] = await Promise.all([
    supabase.from("admins").select("id").eq("user_id", user.id).maybeSingle(),
    supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (adminRow) return "admin";
  if (teacherRow) return "teacher";
  return null;
});
