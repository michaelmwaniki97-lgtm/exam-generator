import { getBetterAuthFoundation } from "@/lib/better-auth/server";
import { handleConfiguredBetterAuthHttpRequest } from "@/lib/better-auth/http-gate";

async function handleBetterAuthRequest(request: Request): Promise<Response> {
  return handleConfiguredBetterAuthHttpRequest(request, async () => {
    const auth = await getBetterAuthFoundation();
    return auth.handler;
  });
}

export const GET = handleBetterAuthRequest;
export const POST = handleBetterAuthRequest;
