import type { AuthenticatedUser } from "./contracts.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeAuthenticatedUser(input: unknown): AuthenticatedUser | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { id?: unknown; email?: unknown };
  if (typeof candidate.id !== "string" || !UUID_PATTERN.test(candidate.id)) return null;
  if (candidate.email != null && typeof candidate.email !== "string") return null;
  return { id: candidate.id, email: candidate.email ?? null };
}
