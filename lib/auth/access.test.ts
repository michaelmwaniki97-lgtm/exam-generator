import assert from "node:assert/strict";
import test from "node:test";
import { canAccessArea, homeForRole, isAdminRole } from "./access.ts";

test("teachers are routed to the teacher dashboard", () => {
  assert.equal(homeForRole("teacher"), "/teacher/dashboard");
  assert.equal(canAccessArea("teacher", "teacher"), true);
  assert.equal(canAccessArea("teacher", "admin"), false);
});

test("admins are routed to the admin dashboard", () => {
  assert.equal(homeForRole("admin"), "/admin");
  assert.equal(canAccessArea("admin", "admin"), true);
  assert.equal(canAccessArea("admin", "teacher"), false);
});

test("a user without an application role cannot access protected areas", () => {
  assert.equal(canAccessArea(null, "admin"), false);
  assert.equal(canAccessArea(null, "teacher"), false);
});

test("admin mutation authorization rejects teachers and anonymous users", () => {
  assert.equal(isAdminRole("admin"), true);
  assert.equal(isAdminRole("teacher"), false);
  assert.equal(isAdminRole(null), false);
});
