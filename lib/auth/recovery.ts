export function recoveryRedirectUrl(environment: Record<string, string | undefined>): string {
  const configured = environment.PUBLIC_APP_URL;
  if (configured) {
    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Invalid PUBLIC_APP_URL.");
    if (environment.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use HTTPS in production.");
    return new URL("/auth/callback", url.origin).toString();
  }
  const productionHost = environment.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost) return new URL("/auth/callback", `https://${productionHost}`).toString();
  if (environment.NODE_ENV !== "production") return "http://localhost:3000/auth/callback";
  throw new Error("No approved application origin is configured.");
}
