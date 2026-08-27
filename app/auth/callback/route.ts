import { NextResponse, type NextRequest } from "next/server";
import { getAuthBackendName } from "@/lib/auth-backend/config";
import { createClient } from "@/lib/supabase/server";
import { recoveryRedirectUrl } from "@/lib/auth/recovery";

export async function GET(request: NextRequest) {
  let origin: string;
  try { origin = new URL(recoveryRedirectUrl(process.env)).origin; }
  catch { return NextResponse.redirect(new URL("/forgot-password?error=configuration", request.url)); }

  // Better Auth password-reset links redirect directly to /reset-password with
  // their own one-time token. Never exchange a Supabase PKCE code when the
  // configured backend is Better Auth.
  if (getAuthBackendName() === "better-auth") {
    return NextResponse.redirect(new URL("/reset-password?error=invalid_link", origin));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/reset-password?error=invalid_link", origin));
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const response = NextResponse.redirect(new URL(error ? "/reset-password?error=invalid_link" : "/reset-password", origin));
  if (!error) response.cookies.set("auth-recovery", "active", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return response;
}
