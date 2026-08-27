import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { updateSession as updateSupabaseSession } from "../supabase/middleware.ts";
import { getBetterAuthAuthenticatedUserFromHeaders } from "./better-auth.ts";
import { getAuthBackendName } from "./config.ts";
import { assertAuthCutoverConfiguration } from "./cutover-state.ts";
import { decideAuthProxyAccess, isProtectedAuthPath } from "./proxy-policy.ts";

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

async function updateBetterAuthProxy(request: NextRequest) {
  // Do not make a database call for public routes. Protected layouts/actions
  // still perform their own full authentication + authorization checks.
  if (!isProtectedAuthPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let isAuthenticated = false;
  try {
    isAuthenticated = Boolean(
      await getBetterAuthAuthenticatedUserFromHeaders(request.headers),
    );
  } catch {
    // Database/session validation errors fail closed for protected routes.
    isAuthenticated = false;
  }

  return decideAuthProxyAccess(request.nextUrl.pathname, isAuthenticated) === "redirect-login"
    ? redirectToLogin(request)
    : NextResponse.next({ request });
}

export async function updateConfiguredAuthProxy(request: NextRequest) {
  assertAuthCutoverConfiguration();
  return getAuthBackendName() === "better-auth"
    ? updateBetterAuthProxy(request)
    : updateSupabaseSession(request);
}
