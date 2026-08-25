import assert from "node:assert/strict";
import test from "node:test";
import { recoveryRedirectUrl } from "./recovery.ts";

test("recovery callback is pinned to the configured application origin", () => {
  assert.equal(recoveryRedirectUrl({ PUBLIC_APP_URL: "https://exams.example/ignored", NODE_ENV: "production" }), "https://exams.example/auth/callback");
  assert.equal(recoveryRedirectUrl({ VERCEL_PROJECT_PRODUCTION_URL: "exams.vercel.app", NODE_ENV: "production" }), "https://exams.vercel.app/auth/callback");
});

test("recovery callback rejects unsafe production origins and has a development fallback", () => {
  assert.throws(() => recoveryRedirectUrl({ PUBLIC_APP_URL: "http://exams.example", NODE_ENV: "production" }));
  assert.throws(() => recoveryRedirectUrl({ NODE_ENV: "production" }));
  assert.equal(recoveryRedirectUrl({ NODE_ENV: "development" }), "http://localhost:3000/auth/callback");
});
