import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatabaseBackendName } from "./config.ts";
import { SupabaseAuthenticatedRpcDatabase, SupabaseTrustedRpcDatabase } from "./supabase-rpc.ts";

test("database backend is self-hosted by default in development and explicit in production", () => {
  assert.equal(getDatabaseBackendName({ NODE_ENV: "development" }), "postgres");
  assert.equal(getDatabaseBackendName({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }), "postgres");
  assert.throws(
    () => getDatabaseBackendName({ NODE_ENV: "production" }),
    /DATABASE_BACKEND is required in production/,
  );
  assert.equal(getDatabaseBackendName({ NODE_ENV: "production", DATABASE_BACKEND: "postgres" }), "postgres");
  assert.equal(getDatabaseBackendName({ NODE_ENV: "production", DATABASE_BACKEND: "supabase" }), "supabase");
  assert.equal(getDatabaseBackendName({ NODE_ENV: "test" }), "supabase");
  assert.throws(() => getDatabaseBackendName({ DATABASE_BACKEND: "browser-choice" }), /supabase or postgres/);
});

test("Supabase adapters map all 13 typed operations to exact RPC names", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "list_ready_textbooks" || name === "match_textbook_chunks" || name.startsWith("claim_ai_")) return { data: [], error: null };
      if (name === "begin_payment_attempt") return { data: { id: "payment" }, error: null };
      if (name.includes("persist_generated")) return { data: "exam", error: null };
      if (name.includes("persist_regenerated") || name === "update_exam_and_scheme_atomic") return { data: 2, error: null };
      return { data: true, error: null };
    },
  } as unknown as SupabaseClient;
  const authenticated = new SupabaseAuthenticatedRpcDatabase(client);
  const trusted = new SupabaseTrustedRpcDatabase(client);
  await authenticated.listReadyTextbooks({ subjectId: "subject", gradeId: "grade" });
  await trusted.importVerifiedCurriculum({ schema_version: 1 });
  await trusted.matchTextbookChunks({ textbookId: "book", queryEmbedding: [1, 0], limit: 8 });
  await trusted.updateExamAndSchemeAtomic({ examId: "exam", teacherId: "teacher", expectedRevision: 1, examContent: {}, markingContent: {} });
  await trusted.claimAiGeneration({ teacherId: "teacher", requestKey: "request" });
  await trusted.claimAiRegeneration({ teacherId: "teacher", examId: "exam", slotId: "slot", requestKey: "request", expectedRevision: 1 });
  await trusted.persistGeneratedExam({ teacherId: "teacher", reservationId: "reservation", requestKey: "request", subjectId: "subject", gradeId: "grade", examType: "type", marks: 20, duration: 30, difficulty: "medium", term: "Term 1", year: 2026, examContent: {}, markingContent: {} });
  await trusted.persistRegeneratedExam({ teacherId: "teacher", reservationId: "reservation", requestKey: "request", examId: "exam", slotId: "slot", expectedRevision: 1, examContent: {}, markingContent: {} });
  await trusted.failAiOperation({ teacherId: "teacher", reservationId: "reservation" });
  await trusted.beginPaymentAttempt({ examId: "exam", teacherId: "teacher", phone: "254711000000", provider: "daraja", idempotencyKey: "key" });
  await trusted.acquirePaymentQueryLease({ paymentId: "payment", leaseToken: "lease" });
  await trusted.completePaymentQueryLease({ paymentId: "payment", leaseToken: "lease" });
  await trusted.finalizeVerifiedPayment({ paymentId: "payment", examId: "exam", teacherId: "teacher", provider: "daraja", amount: 100, currency: "KES", providerReference: "reference" });
  assert.deepEqual(calls.map(({ name }) => name), [
    "list_ready_textbooks", "import_verified_curriculum", "match_textbook_chunks", "update_exam_and_scheme_atomic",
    "claim_ai_generation", "claim_ai_regeneration", "persist_generated_exam_and_complete_ai_operation",
    "persist_regenerated_exam_and_complete_ai_operation", "fail_ai_operation", "begin_payment_attempt",
    "acquire_payment_query_lease", "complete_payment_query_lease", "finalize_verified_payment",
  ]);
  assert.deepEqual(calls[2].args.p_query_embedding, "[1,0]");
  assert.equal(calls[12].args.p_result_description, null);
});
