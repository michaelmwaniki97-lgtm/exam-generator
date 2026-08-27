function applicationOrigin(environment: Record<string, string | undefined>): string {
  const configured = environment.PUBLIC_APP_URL;
  if (configured) {
    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Invalid PUBLIC_APP_URL.");
    if (environment.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use HTTPS in production.");
    return url.origin;
  }
  const productionHost = environment.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost) return new URL(`https://${productionHost}`).origin;
  if (environment.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("No approved application origin is configured.");
}

export function recoveryRedirectUrl(environment: Record<string, string | undefined>): string {
  return new URL("/auth/callback", applicationOrigin(environment)).toString();
}

export function passwordResetPageUrl(environment: Record<string, string | undefined>): string {
  return new URL("/reset-password", applicationOrigin(environment)).toString();
}
