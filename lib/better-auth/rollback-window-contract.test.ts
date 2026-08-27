import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AUTH_CUTOVER_FROZEN_MESSAGE,
  assertAuthRollbackWindowFrozen,
  getAuthMutationMode,
  isBetterAuthHttpRequestAllowedDuringFreeze,
} from "../auth-backend/cutover-mode.ts";

const ROOT = new URL("../../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");

test("auth mutation mode defaults normal and requires explicit cutover freeze", () => {
  assert.equal(getAuthMutationMode({}), "normal");
  assert.equal(getAuthMutationMode({ AUTH_MUTATION_MODE: "normal" }), "normal");
  assert.equal(getAuthMutationMode({ AUTH_MUTATION_MODE: "cutover-freeze" }), "cutover-freeze");
  assert.throws(() => getAuthMutationMode({ AUTH_MUTATION_MODE: "browser-choice" }), /normal or cutover-freeze/);
  assert.doesNotThrow(() => assertAuthRollbackWindowFrozen({ AUTH_MUTATION_MODE: "cutover-freeze" }));
  assert.throws(() => assertAuthRollbackWindowFrozen({ AUTH_MUTATION_MODE: "normal" }), /cutover-freeze/);
  assert.match(AUTH_CUTOVER_FROZEN_MESSAGE, /Existing users can still log in/);
});

test("cutover freeze allows only login logout and session HTTP traffic", () => {
  assert.equal(isBetterAuthHttpRequestAllowedDuringFreeze(new Request("https://exam.test/api/auth/get-session")), true);
  assert.equal(isBetterAuthHttpRequestAllowedDuringFreeze(new Request("https://exam.test/api/auth/sign-in/email", { method: "POST" })), true);
  assert.equal(isBetterAuthHttpRequestAllowedDuringFreeze(new Request("https://exam.test/api/auth/sign-out", { method: "POST" })), true);

  for (const path of [
    "/api/auth/sign-up/email",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
    "/api/auth/change-password",
    "/api/auth/change-email",
    "/api/auth/delete-user",
  ]) {
    assert.equal(isBetterAuthHttpRequestAllowedDuringFreeze(new Request(`https://exam.test${path}`, { method: "POST" })), false, path);
  }
});

test("configured app mutations are frozen before either auth backend can mutate", async () => {
  const index = await source("lib/auth-backend/index.ts");
  assert.match(index, /signupWithConfiguredBackend[\s\S]*isAuthMutationFrozen\(\)[\s\S]*AUTH_CUTOVER_FROZEN_MESSAGE[\s\S]*getAuthBackendName/);
  assert.match(index, /requestPasswordResetWithConfiguredBackend[\s\S]*isAuthMutationFrozen\(\)[\s\S]*AUTH_CUTOVER_FROZEN_MESSAGE[\s\S]*getAuthBackendName/);
  assert.match(index, /resetPasswordWithConfiguredBackend[\s\S]*isAuthMutationFrozen\(\)[\s\S]*AUTH_CUTOVER_FROZEN_MESSAGE[\s\S]*getAuthBackendName/);
  assert.doesNotMatch(index, /loginWithConfiguredBackend[\s\S]{0,180}isAuthMutationFrozen/);
  assert.doesNotMatch(index, /logoutWithConfiguredBackend[\s\S]{0,180}isAuthMutationFrozen/);
});

test("Better Auth HTTP gate freezes direct mutations without initializing auth", async () => {
  const gate = await source("lib/better-auth/http-gate.ts");
  const route = await source("app/api/auth/[...all]/route.ts");
  assert.match(gate, /getAuthBackendName\(\) !== "better-auth"/);
  assert.match(gate, /isBetterAuthHttpRequestAllowedDuringFreeze\(request\)/);
  assert.match(gate, /isAuthMutationFrozen\(\)/);
  assert.match(gate, /status: 503/);
  assert.match(gate, /"retry-after": "60"/);
  assert.match(gate, /const handler = await getHandler\(\)/);
  assert.match(route, /handleConfiguredBetterAuthHttpRequest/);
  assert.match(route, /getBetterAuthFoundation\(\)/);
  assert.doesNotMatch(route, /supabase|createClient|NEXT_PUBLIC_/i);
});

test("rollback-window operator check is read-only and requires both freeze and Phase 8 readiness", async () => {
  const script = await source("scripts/check-better-auth-rollback-window.ts");
  assert.match(script, /assertAuthCutoverConfiguration\(process\.env\)/);
  assert.match(script, /AUTH_CUTOVER_STATE=rollback-window/);
  assert.match(script, /assertAuthRollbackWindowFrozen\(process\.env\)/);
  assert.match(script, /assertBetterAuthTrafficEnvironment\(process\.env\)/);
  assert.match(script, /readBetterAuthTrafficReadiness/);
  assert.match(script, /rollbackWindowFrozen: true/);
  assert.doesNotMatch(script, /insert\s+into|update\s+|delete\s+from|alter\s+table|drop\s+/i);
  assert.doesNotMatch(script, /encrypted_password|password|BETTER_AUTH_SECRET[^\n]*console|DATABASE_URL[^\n]*console/i);
});
