import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_INPUT_LIMITS,
  validateLoginFields,
  validateSignupFields,
} from "./validation.ts";

const validSignup = {
  name: "Amina Teacher",
  email: "amina@example.test",
  password: "correct-horse-battery-staple",
  school: "Example Secondary School",
  phone: "+254700000000",
};

test("normal signup and login fields pass server-side bounds", () => {
  assert.equal(validateSignupFields(validSignup), null);
  assert.equal(
    validateLoginFields({
      email: validSignup.email,
      password: validSignup.password,
    }),
    null
  );
});

test("signup rejects missing, undersized and oversized fields", () => {
  assert.match(
    validateSignupFields({ ...validSignup, name: "A" }) ?? "",
    /full name/
  );
  assert.match(
    validateSignupFields({
      ...validSignup,
      email: "e".repeat(AUTH_INPUT_LIMITS.email + 1),
    }) ?? "",
    /too long/
  );
  assert.match(
    validateSignupFields({ ...validSignup, password: "short" }) ?? "",
    /at least 6/
  );
  assert.match(
    validateSignupFields({
      ...validSignup,
      school: "s".repeat(AUTH_INPUT_LIMITS.school + 1),
    }) ?? "",
    /School/
  );
  assert.match(
    validateSignupFields({
      ...validSignup,
      phone: "1".repeat(AUTH_INPUT_LIMITS.phone + 1),
    }) ?? "",
    /Phone number/
  );
});

test("login bounds prevent oversized credential payloads", () => {
  assert.match(validateLoginFields({ email: "", password: "" }) ?? "", /enter/);
  assert.match(
    validateLoginFields({
      email: validSignup.email,
      password: "p".repeat(AUTH_INPUT_LIMITS.password + 1),
    }) ?? "",
    /too long/
  );
});
