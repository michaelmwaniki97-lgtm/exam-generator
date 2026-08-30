import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseRpcError } from "./contracts.ts";
import { isMissingOptionalTextbookSchema } from "./optional-textbook-schema.ts";

test("optional textbook degradation recognizes only the missing pgvector schema boundary", () => {
  assert.equal(isMissingOptionalTextbookSchema(new DatabaseRpcError(
    "function public.list_ready_textbooks(uuid, uuid) does not exist",
    "42883",
  )), true);
  assert.equal(isMissingOptionalTextbookSchema(new DatabaseRpcError(
    'relation "public.textbook_documents" does not exist',
    "42P01",
  )), true);
  assert.equal(isMissingOptionalTextbookSchema(new DatabaseRpcError("permission denied", "42501")), false);
  assert.equal(isMissingOptionalTextbookSchema(new Error("list_ready_textbooks")), false);
});
