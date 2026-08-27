import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionSource = readFileSync(new URL("../../app/actions/textbooks.ts", import.meta.url), "utf8");
const postgresWorkflowSource = readFileSync(new URL("../textbook-workflow/postgres.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../../supabase/migrations/20260823120000_add_private_textbook_rag.sql", import.meta.url), "utf8");

test("textbook mutations are protected by the centralized admin role gate", () => {
  assert.match(actionSource, /isAdminRole\(role\)/);
  assert.match(actionSource, /export async function uploadTextbookDocument[\s\S]*?adminContext\(\)/);
  assert.match(actionSource, /export async function processTextbookDocument[\s\S]*?adminContext\(\)/);
  assert.match(actionSource, /export async function removeTextbookDocument[\s\S]*?adminContext\(\)/);
});

test("storage remains private and retrieval is service-role-only", () => {
  assert.match(migrationSource, /values \('textbooks', 'textbooks', false/);
  assert.match(migrationSource, /revoke all on function public\.match_textbook_chunks[\s\S]*?from public, anon, authenticated/);
  assert.match(migrationSource, /grant execute on function public\.match_textbook_chunks[\s\S]*?to service_role/);
  assert.match(migrationSource, /c\.textbook_id = p_textbook_id/);
  assert.match(migrationSource, /d\.processing_status = 'ready'/);
});

test("processing cannot publish ready before chunk persistence", () => {
  const insertPosition = postgresWorkflowSource.indexOf("insert into public.textbook_chunks");
  const readyPosition = postgresWorkflowSource.indexOf("processing_status='ready'");
  assert.ok(insertPosition >= 0 && readyPosition > insertPosition);
  assert.match(actionSource, /catch \(error\)[\s\S]*?clearChunksAndMarkFailed/);
  assert.match(actionSource, /process\.env\.NODE_ENV === "development"/);
  assert.match(actionSource, /\[Textbook Processing\] stage=\$\{stage\} document=\$\{document\.id\} error=\$\{diagnosticError\(error\)\}/);
  assert.doesNotMatch(actionSource, /console\.error\([^\n]*(?:apiKey|storage_path|storagePath|Authorization)/);
});
