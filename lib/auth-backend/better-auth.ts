import "server-only";

import { headers } from "next/headers";
import { getBetterAuthFoundation } from "../better-auth/server.ts";
import type { AuthenticatedUser } from "./contracts.ts";
import { normalizeAuthenticatedUser } from "./normalize.ts";

export async function getBetterAuthAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const auth = await getBetterAuthFoundation();
  const session = await auth.api.getSession({ headers: await headers() });
  return normalizeAuthenticatedUser(session?.user);
}
