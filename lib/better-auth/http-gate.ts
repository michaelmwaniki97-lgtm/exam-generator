import {
  AUTH_CUTOVER_FROZEN_MESSAGE,
  isAuthMutationFrozen,
  isBetterAuthHttpRequestAllowedDuringFreeze,
} from "../auth-backend/cutover-mode.ts";
import { getAuthBackendName } from "../auth-backend/config.ts";
import { assertAuthCutoverConfiguration } from "../auth-backend/cutover-state.ts";

export type BetterAuthHttpHandler = (request: Request) => Response | Promise<Response>;

export async function handleConfiguredBetterAuthHttpRequest(
  request: Request,
  getHandler: () => Promise<BetterAuthHttpHandler>,
): Promise<Response> {
  assertAuthCutoverConfiguration();

  // Keep Better Auth HTTP completely inert while Supabase is authoritative.
  if (getAuthBackendName() !== "better-auth") {
    return new Response("Not Found", { status: 404 });
  }

  // This application owns signup and credential mutation semantics in Server
  // Actions because those flows also provision/validate application identity.
  // Never expose Better Auth's generic mutation endpoints as a bypass. The
  // mounted HTTP surface is intentionally limited to login/session/logout.
  if (!isBetterAuthHttpRequestAllowedDuringFreeze(request)) {
    if (isAuthMutationFrozen()) {
      return new Response(AUTH_CUTOVER_FROZEN_MESSAGE, {
        status: 503,
        headers: { "retry-after": "60" },
      });
    }
    return new Response("Not Found", { status: 404 });
  }

  const handler = await getHandler();
  return handler(request);
}
