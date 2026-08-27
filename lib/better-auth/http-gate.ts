import {
  AUTH_CUTOVER_FROZEN_MESSAGE,
  isAuthMutationFrozen,
  isBetterAuthHttpRequestAllowedDuringFreeze,
} from "../auth-backend/cutover-mode.ts";
import { getAuthBackendName } from "../auth-backend/config.ts";

export type BetterAuthHttpHandler = (request: Request) => Response | Promise<Response>;

export async function handleConfiguredBetterAuthHttpRequest(
  request: Request,
  getHandler: () => Promise<BetterAuthHttpHandler>,
): Promise<Response> {
  // Keep Better Auth HTTP completely inert while Supabase is authoritative.
  if (getAuthBackendName() !== "better-auth") {
    return new Response("Not Found", { status: 404 });
  }

  // During the rollback acceptance window, permit only non-durable session
  // operations. This prevents a browser/API caller from bypassing the app's
  // Server Actions and creating Better-Auth-only identities or credentials.
  if (isAuthMutationFrozen() && !isBetterAuthHttpRequestAllowedDuringFreeze(request)) {
    return new Response(AUTH_CUTOVER_FROZEN_MESSAGE, {
      status: 503,
      headers: { "retry-after": "60" },
    });
  }

  const handler = await getHandler();
  return handler(request);
}
