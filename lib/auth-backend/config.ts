export type AuthBackendName = "supabase" | "better-auth";

export function getAuthBackendName(): AuthBackendName {
  const configured = process.env.AUTH_BACKEND?.trim().toLowerCase();
  if (!configured || configured === "supabase") return "supabase";
  if (configured === "better-auth") return "better-auth";
  throw new Error("AUTH_BACKEND must be either supabase or better-auth.");
}
