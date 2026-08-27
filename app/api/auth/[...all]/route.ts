import { getAuthBackendName } from "@/lib/auth-backend/config";
import { getBetterAuthFoundation } from "@/lib/better-auth/server";

async function handleBetterAuthRequest(request: Request): Promise<Response> {
  // Keep the Better Auth HTTP surface completely inert while Supabase remains
  // the configured authority. This also avoids initializing the Better Auth DB
  // pool/secrets on the default rollback path.
  if (getAuthBackendName() !== "better-auth") {
    return new Response("Not Found", { status: 404 });
  }

  const auth = await getBetterAuthFoundation();
  return auth.handler(request);
}

export const GET = handleBetterAuthRequest;
export const POST = handleBetterAuthRequest;
