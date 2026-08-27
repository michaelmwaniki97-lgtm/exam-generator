import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { passwordResetPageUrl, recoveryRedirectUrl } from "../auth/recovery.ts";

const ROOT = new URL("../../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");

test("recovery URLs stay on the approved application origin and preserve backend-specific routes", () => {
  const environment = { PUBLIC_APP_URL: "https://exam.example.test/some-path", NODE_ENV: "production" };
  assert.equal(recoveryRedirectUrl(environment), "https://exam.example.test/auth/callback");
  assert.equal(passwordResetPageUrl(environment), "https://exam.example.test/reset-password");
  assert.throws(() => recoveryRedirectUrl({ PUBLIC_APP_URL: "http://exam.example.test", NODE_ENV: "production" }), /HTTPS/);
  assert.throws(() => passwordResetPageUrl({ PUBLIC_APP_URL: "https://user:pass@exam.example.test", NODE_ENV: "production" }), /Invalid/);
});

test("configured recovery dispatches only from the environment-selected backend", async () => {
  const [index, actions] = await Promise.all([
    source("lib/auth-backend/index.ts"),
    source("app/actions/auth.ts"),
  ]);
  assert.match(index, /requestPasswordResetWithConfiguredBackend[\s\S]*getAuthBackendName\(\) === "better-auth"/);
  assert.match(index, /resetPasswordWithConfiguredBackend[\s\S]*getAuthBackendName\(\) === "better-auth"/);
  assert.match(actions, /requestPasswordResetWithConfiguredBackend\(\{ email \}\)/);
  assert.match(actions, /resetPasswordWithConfiguredBackend\(\{[\s\S]*newPassword: password[\s\S]*token: tokenValue \|\| null/);
  assert.doesNotMatch(actions, /createClient|supabase\.auth\./);
});

test("Supabase recovery keeps historical PKCE cookie semantics inside its adapter", async () => {
  const [adapter, callback] = await Promise.all([
    source("lib/auth-backend/supabase.ts"),
    source("app/auth/callback/route.ts"),
  ]);
  assert.match(adapter, /supabase\.auth\.resetPasswordForEmail\(input\.email, \{ redirectTo \}\)/);
  assert.match(adapter, /cookieStore\.get\("auth-recovery"\)\?\.value !== "active"/);
  assert.match(adapter, /supabase\.auth\.getUser\(\)/);
  assert.match(adapter, /supabase\.auth\.updateUser\(\{ password: input\.newPassword \}\)/);
  assert.match(adapter, /supabase\.auth\.signOut\(\)/);
  assert.match(adapter, /cookieStore\.delete\("auth-recovery"\)/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /auth-recovery/);
});

test("Better Auth recovery uses one-time reset tokens, SMTP, and session revocation", async () => {
  const [adapter, server, options, mailer, resetPage, resetForm] = await Promise.all([
    source("lib/auth-backend/better-auth.ts"),
    source("lib/better-auth/server.ts"),
    source("lib/better-auth/options.ts"),
    source("lib/email/smtp.ts"),
    source("app/(auth)/reset-password/page.tsx"),
    source("components/auth/reset-password-form.tsx"),
  ]);
  assert.match(adapter, /auth\.api\.requestPasswordReset\(\{/);
  assert.match(adapter, /auth\.api\.resetPassword\(\{/);
  assert.match(adapter, /assertPasswordResetEmailConfigured\(\)/);
  assert.match(adapter, /passwordResetPageUrl\(process\.env\)/);
  assert.match(server, /requestPasswordReset\(input:/);
  assert.match(server, /resetPassword\(input:/);
  assert.match(options, /revokeSessionsOnPasswordReset: true/);
  assert.match(options, /resetPasswordTokenExpiresIn: 3600/);
  assert.match(options, /sendResetPassword/);
  assert.match(mailer, /nodemailer\.createTransport/);
  assert.match(mailer, /SMTP_URL/);
  assert.match(mailer, /AUTH_EMAIL_FROM/);
  assert.doesNotMatch(mailer, /NEXT_PUBLIC_/);
  assert.doesNotMatch(mailer, /console\.(?:log|error).*resetUrl|console\.(?:log|error).*input\.to/);
  assert.match(resetPage, /backend === "better-auth"/);
  assert.match(resetPage, /!token/);
  assert.match(resetForm, /type="hidden" name="resetToken"/);
});

test("Better Auth selection makes the legacy Supabase callback fail closed", async () => {
  const callback = await source("app/auth/callback/route.ts");
  const betterBranch = callback.indexOf('getAuthBackendName() === "better-auth"');
  const exchange = callback.indexOf("exchangeCodeForSession(code)");
  assert.ok(betterBranch >= 0 && exchange > betterBranch);
  assert.match(callback, /better-auth"\)[\s\S]*reset-password\?error=invalid_link/);
});
