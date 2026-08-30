import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { updateConfiguredAuthProxy } from "./proxy.ts";
import { decideAuthProxyAccess, isProtectedAuthPath } from "./proxy-policy.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("proxy policy preserves the existing Supabase teacher/admin prefix semantics", () => {
  assert.equal(isProtectedAuthPath("/teacher"), true);
  assert.equal(isProtectedAuthPath("/teacher/dashboard"), true);
  assert.equal(isProtectedAuthPath("/admin"), true);
  assert.equal(isProtectedAuthPath("/admin/textbooks"), true);
  assert.equal(isProtectedAuthPath("/teacherish"), true);
  assert.equal(isProtectedAuthPath("/administrator"), true);
  assert.equal(isProtectedAuthPath("/login"), false);
  assert.equal(decideAuthProxyAccess("/teacher/dashboard", false), "redirect-login");
  assert.equal(decideAuthProxyAccess("/teacher/dashboard", true), "allow");
  assert.equal(decideAuthProxyAccess("/login", false), "allow");
});

test("root Next.js proxy delegates to the configured auth backend", () => {
  const rootProxy = source("../../proxy.ts");
  const adapter = source("./proxy.ts");

  assert.match(rootProxy, /updateConfiguredAuthProxy/);
  assert.doesNotMatch(rootProxy, /supabase\/middleware/);
  assert.match(adapter, /getAuthBackendName\(\) === "better-auth"/);
  assert.match(adapter, /updateSupabaseSession\(request\)/);
});

test("development public proxy uses Better Auth without any Supabase credentials", async () => {
  const names = [
    "NODE_ENV",
    "AUTH_BACKEND",
    "DATABASE_BACKEND",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.NODE_ENV = "development";
    for (const name of names.slice(1)) delete process.env[name];

    const publicResponse = await updateConfiguredAuthProxy(
      new NextRequest("http://localhost:3000/login"),
    );
    assert.equal(publicResponse.status, 200);
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("Better Auth proxy performs database-backed validation, never cookie-existence auth", () => {
  const adapter = source("./proxy.ts");
  const betterAuth = source("./better-auth.ts");

  assert.match(adapter, /getBetterAuthAuthenticatedUserFromHeaders\(request\.headers\)/);
  assert.match(betterAuth, /auth\.api\.getSession\(\{ headers: requestHeaders \}\)/);
  assert.doesNotMatch(adapter + betterAuth, /getSessionCookie|getCookieCache/);
  assert.doesNotMatch(adapter, /request\.cookies\.get/);
  assert.match(adapter, /Database\/session validation errors fail closed/);
});

test("authorization remains in server layouts with admin-first role semantics", () => {
  const adminLayout = source("../../app/admin/layout.tsx");
  const teacherLayout = source("../../app/teacher/layout.tsx");
  const session = source("../auth/session.ts");

  assert.match(adminLayout, /getCurrentUser\(\)/);
  assert.match(adminLayout, /getUserRole\(\)/);
  assert.match(adminLayout, /role === "teacher"\) redirect\("\/teacher\/dashboard"\)/);
  assert.match(teacherLayout, /getCurrentUser\(\)/);
  assert.match(teacherLayout, /getUserRole\(\)/);
  assert.match(teacherLayout, /role === "admin"\) redirect\("\/admin"\)/);
  assert.match(session, /getCurrentIdentityContext\(\)[\s\S]*repository\.resolveRole\(\)/);
  assert.doesNotMatch(adminLayout + teacherLayout, /cookies\(|searchParams|request\.headers/);
});

test("Supabase proxy/session refresh implementation stays intact for the explicit legacy backend", () => {
  const supabaseMiddleware = source("../supabase/middleware.ts");

  assert.match(supabaseMiddleware, /createServerClient/);
  assert.match(supabaseMiddleware, /supabase\.auth\.getUser\(\)/);
  assert.match(supabaseMiddleware, /supabaseResponse\.cookies\.set/);
  assert.match(supabaseMiddleware, /url\.pathname = "\/login"/);
});
