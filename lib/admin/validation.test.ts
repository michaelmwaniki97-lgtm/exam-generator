import assert from "node:assert/strict";
import test from "node:test";
import { cleanId, cleanRequiredText, hasDuplicate } from "./validation.ts";

test("outer whitespace is trimmed without changing internal wording", () => {
  assert.deepEqual(cleanRequiredText("  Number   Activities  ", "Name"), {
    value: "Number   Activities",
  });
  assert.deepEqual(cleanRequiredText("", "Name"), { error: "Name is required." });
});

test("duplicate detection is case-insensitive and supports editing the same row", () => {
  const rows = [{ id: "one", value: "Mathematics" }];
  assert.equal(hasDuplicate(rows, "mathematics"), true);
  assert.equal(hasDuplicate(rows, "Mathematics", "one"), false);
});

test("record identifiers must be UUIDs", () => {
  assert.deepEqual(cleanId("not-an-id", "record"), { error: "Invalid record." });
  assert.deepEqual(cleanId("123e4567-e89b-12d3-a456-426614174000", "record"), {
    value: "123e4567-e89b-12d3-a456-426614174000",
  });
});
