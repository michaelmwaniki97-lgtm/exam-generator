import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  assertAuthCutoverConfiguration,
  assertLegacySupabaseAuthAllowed,
  getAuthCutoverState,
} from "../auth-backend/cutover-state.ts";

const ROOT = new URL("../../", import.meta.url);
const source = (file: string) => readFile(new URL(file, ROOT), "utf8");

test("auth cutover lifecycle separates compatibility, rollback-window, and accepted states", () => {
  assert.equal(getAuthCutoverState({}), "compatibility");
  assert.equal(getAuthCutoverState({ AUTH_CUTOVER_STATE: "rollback-window" }), "rollback-window");
  assert.equal(getAuthCutoverState({ AUTH_CUTOVER_STATE: "accepted" }), "accepted");
  assert.throws(() => getAuthCutoverState({ AUTH_CUTOVER_STATE: "maybe" }), /compatibility, rollback-window, or accepted/);

  assert.doesNotThrow(() => assertAuthCutoverConfiguration({}));
  assert.doesNotThrow(() => assertAuthCutoverConfiguration({
    AUTH_CUTOVER_STATE: "rollback-window",
    AUTH_BACKEND: "better-auth",
    DATABASE_BACKEND: "postgres",
    AUTH_MUTATION_MODE: "cutover-freeze",
  }));
  assert.doesNotThrow(() => assertAuthCutoverConfiguration({
    AUTH_CUTOVER_STATE: "rollback-window",
    AUTH_BACKEND: "supabase",
    DATABASE_BACKEND: "postgres",
    AUTH_MUTATION_MODE: "cutover-freeze",
  }));
  assert.doesNotThrow(() => assertAuthCutoverConfiguration({
    AUTH_CUTOVER_STATE: "accepted",
    AUTH_BACKEND: "better-auth",
    DATABASE_BACKEND: "postgres",
    AUTH_MUTATION_MODE: "normal",
  }));
  assert.throws(() => assertAuthCutoverConfiguration({
    AUTH_CUTOVER_STATE: "accepted",
    AUTH_BACKEND: "supabase",
    DATABASE_BACKEND: "postgres",
    AUTH_MUTATION_MODE: "normal",
  }), /AUTH_BACKEND=better-auth/);
  assert.throws(() => assertAuthCutoverConfiguration({
    AUTH_CUTOVER_STATE: "accepted",
    AUTH_BACKEND: "better-auth",
    DATABASE_BACKEND: "postgres",
    AUTH_MUTATION_MODE: "cutover-freeze",
  }), /AUTH_MUTATION_MODE=normal/);
  assert.throws(() => assertLegacySupabaseAuthAllowed({ AUTH_CUTOVER_STATE: "accepted" }), /Supabase Auth is retired/);
});

test("accepted mode guards every retained Supabase Auth runtime boundary", async () => {
  const [adapter, middleware, callback, proxy, index] = await Promise.all([
    source("lib/auth-backend/supabase.ts"),
    source("lib/supabase/middleware.ts"),
    source("app/auth/callback/route.ts"),
    source("lib/auth-backend/proxy.ts"),
    source("lib/auth-backend/index.ts"),
  ]);

  assert.match(adapter, /assertLegacySupabaseAuthAllowed\(\)/);
  assert.match(middleware, /assertLegacySupabaseAuthAllowed\(\)/);
  assert.match(callback, /isAuthCutoverAccepted\(\)[\s\S]*status: 410/);
  assert.match(proxy, /assertAuthCutoverConfiguration\(\)/);
  assert.match(index, /assertAuthCutoverConfiguration\(\)/);
});

test("generic Better Auth HTTP mutations cannot bypass application-managed identity flows", async () => {
  const [gate, mode] = await Promise.all([
    source("lib/better-auth/http-gate.ts"),
    source("lib/auth-backend/cutover-mode.ts"),
  ]);
  assert.match(gate, /mounted HTTP surface is intentionally limited to login\/session\/logout/);
  assert.match(gate, /!isBetterAuthHttpRequestAllowedDuringFreeze\(request\)/);
  assert.match(gate, /isAuthMutationFrozen\(\)[\s\S]*status: 503/);
  assert.match(gate, /return new Response\("Not Found", \{ status: 404 \}\)/);
  assert.match(mode, /GET \/api\/auth\/get-session/);
  assert.match(mode, /POST \/api\/auth\/sign-in\/email/);
  assert.match(mode, /POST \/api\/auth\/sign-out/);
  assert.doesNotMatch(mode, /POST \/api\/auth\/sign-up\/email/);
});

test("accepted provisioning requires Better Auth FK anchors and does not rely on auth.users", async () => {
  const bridge = await source("lib/better-auth/application-bridge.ts");
  assert.match(bridge, /to_regclass\('public\.textbook_documents'\)/);
  assert.match(bridge, /isAuthCutoverAccepted\(\) && !textbookDocumentsExists/);
  assert.match(bridge, /isAuthCutoverAccepted\(\) && anchor !== "better_auth\.users"/);
  assert.match(bridge, /Accepted Better Auth cutover requires application FKs to better_auth\.users/);
  assert.match(bridge, /insert into public\.teachers/);
});

test("final acceptance readiness allows post-acceptance Better-Auth-only users but preserves historical and RLS guarantees", async () => {
  const [readiness, script, env, docs] = await Promise.all([
    source("lib/better-auth/cutover-readiness.ts"),
    source("scripts/check-better-auth-finalization.ts"),
    source(".env.example"),
    source("docs/SELF_HOSTED_DATABASE_ABSTRACTION.md"),
  ]);

  const acceptedBody = readiness.split("export function isBetterAuthAcceptedReady", 2)[1] ?? "";
  assert.match(acceptedBody, /historicalUsersMissingBetterAuth === 0/);
  assert.doesNotMatch(acceptedBody.split("}", 1)[0] ?? "", /betterAuthUsersMissingHistorical === 0/);
  assert.match(acceptedBody, /reviewedForeignKeys === 3/);
  assert.match(acceptedBody, /authenticatedCanExecuteAuthUid/);
  assert.match(script, /AUTH_CUTOVER_STATE=accepted/);
  assert.match(script, /isBetterAuthAcceptedReady/);
  assert.match(script, /postAcceptanceBetterAuthOnlyUsersAllowed: true/);
  assert.doesNotMatch(script, /insert\s+into|update\s+|delete\s+from|alter\s+table|drop\s+/i);
  assert.match(env, /AUTH_CUTOVER_STATE=compatibility/);
  assert.match(docs, /one-way operational boundary/i);
  assert.match(docs, /separate reconciliation\/migration plan/i);
});

async function runtimeTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(new URL(dir, ROOT), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.posix.join(dir.replace(/\/$/, ""), entry.name);
    if (entry.isDirectory()) files.push(...await runtimeTsFiles(`${relative}/`));
    else if (/\.tsx?$/.test(entry.name) && !/\.(?:test|integration\.test)\.tsx?$/.test(entry.name)) files.push(relative);
  }
  return files;
}

test("direct Supabase Auth calls are confined to guarded legacy files after finalization", async () => {
  const files = ["proxy.ts", ...await runtimeTsFiles("app/"), ...await runtimeTsFiles("lib/")];
  const hits: string[] = [];
  for (const file of files) {
    const text = await source(file);
    if (/supabase\.auth\./.test(text)) hits.push(file);
  }
  assert.deepEqual(hits.sort(), [
    "app/auth/callback/route.ts",
    "lib/auth-backend/supabase.ts",
    "lib/supabase/middleware.ts",
  ]);
});
