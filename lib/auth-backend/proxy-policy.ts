export const PROTECTED_AUTH_PREFIXES = ["/teacher", "/admin"] as const;

export function isProtectedAuthPath(pathname: string): boolean {
  return PROTECTED_AUTH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

export type AuthProxyDecision = "allow" | "redirect-login";

export function decideAuthProxyAccess(
  pathname: string,
  isAuthenticated: boolean,
): AuthProxyDecision {
  return isProtectedAuthPath(pathname) && !isAuthenticated
    ? "redirect-login"
    : "allow";
}
