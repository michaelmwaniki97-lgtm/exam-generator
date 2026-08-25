import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ExamBlueprint } from "../blueprint/types.ts";
import {
  AI_ABUSE_LIMITS,
  AiAbuseControlError,
  MAX_GENERATION_PROVIDER_CALLS,
  assertGenerationProviderBudget,
  regenerationRequestTimeoutMs,
} from "./abuse-controls-core.ts";
import { AI_OPERATION_TIMING, REGENERATION_LEASE_SECONDS } from "./timing.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260825120000_add_ai_operation_reservations.sql", import.meta.url),
  "utf8"
);
const examAction = readFileSync(new URL("../../app/actions/exams.ts", import.meta.url), "utf8");
const editorAction = readFileSync(new URL("../../app/actions/exam-editor.ts", import.meta.url), "utf8");
const regenerationProvider = readFileSync(new URL("../exam-editor/regenerate-question.ts", import.meta.url), "utf8");
const aiClient = readFileSync(new URL("./client.ts", import.meta.url), "utf8");
const aiConfig = readFileSync(new URL("./config.ts", import.meta.url), "utf8");
const generateBody = examAction.slice(examAction.indexOf("export async function generateExam"));
const regenerateBody = editorAction.slice(editorAction.indexOf("export async function regenerateExamQuestion"));

function blueprintWithSlots(count: number): ExamBlueprint {
  return { questionSlots: Array.from({ length: count }, (_, index) => ({ id: `slot-${index}` })) } as unknown as ExamBlueprint;
}

test("full generation claim is atomic, exclusive, quota-bound and stale-recoverable", () => {
  assert.match(migration, /perform 1 from public\.teachers where id = p_teacher_id for update/);
  assert.match(migration, /lease_expires_at <= now\(\)[\s\S]*?'expired'/);
  assert.match(migration, /ai_one_active_generation_per_teacher/);
  assert.match(migration, /return query select 'busy'/);
  assert.match(migration, />= 10[\s\S]*?'quota_exceeded'/);
  assert.match(migration, /values \(p_teacher_id, 'generation',[\s\S]*?'active'/);
});

test("reservation rows enforce operation-specific target shape", () => {
  assert.match(migration, /operation_type = 'generation' and target_exam_id is null and target_slot_id is null/);
  assert.match(migration, /operation_type = 'regeneration' and target_exam_id is not null and target_slot_id is not null and\s+length\(target_slot_id\) between 1 and 200/);
});

test("generation idempotency reuses one logical request and retains its result exam", () => {
  assert.match(migration, /unique \(teacher_id, operation_type, request_key\)/);
  assert.match(migration, /v_existing\.status = 'completed'[\s\S]*?v_existing\.result_exam_id/);
  assert.match(migration, /exams_teacher_generation_request_unique/);
  assert.match(examAction, /await persistGeneratedExam\([\s\S]*?requestId/);
  assert.match(migration, /'generated', p_request_key, p_exam_content/);
  assert.ok(generateBody.indexOf("claimFullGeneration") < generateBody.indexOf("prepareTextbookGrounding"));
  assert.ok(generateBody.indexOf("claimFullGeneration") < generateBody.indexOf("await callAi"));
});

test("generation persistence and reservation completion use one atomic RPC", () => {
  const atomicRpc = migration.slice(
    migration.indexOf("create function public.persist_generated_exam_and_complete_ai_operation"),
    migration.indexOf("create function public.persist_regenerated_exam_and_complete_ai_operation")
  );
  assert.match(atomicRpc, /from public\.ai_operation_reservations[\s\S]*?for update/);
  assert.match(atomicRpc, /operation_type <> 'generation'/);
  assert.match(atomicRpc, /status <> 'active'[\s\S]*?lease_expires_at <= now\(\)/);
  assert.match(atomicRpc, /insert into public\.exams[\s\S]*?insert into public\.marking_schemes[\s\S]*?status = 'completed'/);
  assert.match(atomicRpc, /result_exam_id = v_exam_id/);
  assert.match(examAction, /await persistGeneratedExam\(/);
  assert.doesNotMatch(examAction, /completeAiReservation|\.from\("exams"\)\.insert|\.from\("marking_schemes"\)\.insert/);
  assert.match(examAction, /finally \{[\s\S]*?failAiReservation\(teacher\.id, reservationId\)/);
  assert.match(migration, /status = 'failed'.*lease_expires_at = now\(\)/);
});

test("generation response-loss replay returns the committed exam without provider work", () => {
  assert.match(migration, /v_existing\.status = 'completed'[\s\S]*?v_existing\.result_exam_id/);
  const completed = generateBody.indexOf('claim.outcome === "completed"');
  assert.ok(completed > 0 && completed < generateBody.indexOf("prepareTextbookGrounding"));
  assert.ok(completed < generateBody.indexOf("await callAi"));
  assert.match(migration, /exams_teacher_generation_request_unique/);
});

test("regeneration persistence, revision and reservation completion use one atomic RPC", () => {
  const atomicRpc = migration.slice(
    migration.indexOf("create function public.persist_regenerated_exam_and_complete_ai_operation"),
    migration.indexOf("create function public.fail_ai_operation")
  );
  assert.match(atomicRpc, /operation_type <> 'regeneration'/);
  assert.match(atomicRpc, /target_exam_id <> p_exam_id[\s\S]*?target_slot_id <> p_slot_id/);
  assert.match(atomicRpc, /from public\.exams where id = p_exam_id for update/);
  assert.match(atomicRpc, /v_exam\.teacher_id <> p_teacher_id/);
  assert.match(atomicRpc, /v_exam\.revision <> p_expected_revision/);
  assert.match(atomicRpc, /update public\.marking_schemes[\s\S]*?update public\.exams[\s\S]*?result_revision = v_new_revision/);
  assert.match(editorAction, /await persistRegeneratedQuestion\(/);
  assert.doesNotMatch(regenerateBody, /completeAiReservation|await persist\(/);
});

test("regeneration response-loss replay returns its stored revision before grounding", () => {
  const claimRpc = migration.slice(
    migration.indexOf("create function public.claim_ai_regeneration"),
    migration.indexOf("create function public.persist_generated_exam_and_complete_ai_operation")
  );
  assert.match(claimRpc, /teacher_id = p_teacher_id and operation_type = 'regeneration' and request_key = p_request_key/);
  assert.match(claimRpc, /target_exam_id <> p_exam_id or v_existing\.target_slot_id <> p_slot_id/);
  assert.match(migration, /v_existing\.status = 'completed' and v_existing\.result_revision is not null/);
  assert.match(editorAction, /claim\.outcome === "completed"[\s\S]*?revision: claim\.resultRevision/);
  const completed = regenerateBody.indexOf('claim.outcome === "completed"');
  assert.ok(completed > 0 && completed < regenerateBody.indexOf("prepareRegenerationGrounding"));
  assert.ok(completed < regenerateBody.indexOf("await regenerateQuestion"));
  assert.ok(completed < regenerateBody.indexOf("persistRegeneratedQuestion"));
  assert.ok(claimRpc.indexOf("v_existing.status = 'completed'") < claimRpc.indexOf("revision = p_expected_revision"));
});

test("only an exactly correlated completed regeneration qualifies for replay", () => {
  const claimRpc = migration.slice(
    migration.indexOf("create function public.claim_ai_regeneration"),
    migration.indexOf("create function public.persist_generated_exam_and_complete_ai_operation")
  );
  assert.match(claimRpc, /teacher_id = p_teacher_id and operation_type = 'regeneration' and request_key = p_request_key/);
  assert.match(claimRpc, /target_exam_id <> p_exam_id or v_existing\.target_slot_id <> p_slot_id[\s\S]*?select 'terminal'/);
  assert.match(claimRpc, /status = 'completed' and v_existing\.result_revision is not null/);
  assert.match(claimRpc, /elsif v_existing\.status = 'active'[\s\S]*?'duplicate_active'/);
  assert.match(claimRpc, /else return query select 'terminal'/);
});

test("atomic persistence RPCs are service-role only and ordinary saves retain their RPC", () => {
  assert.match(migration, /revoke all on function public\.persist_generated_exam_and_complete_ai_operation\([\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.persist_generated_exam_and_complete_ai_operation\([\s\S]*?to service_role/);
  assert.match(migration, /revoke all on function public\.persist_regenerated_exam_and_complete_ai_operation\([\s\S]*?from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.persist_regenerated_exam_and_complete_ai_operation\([\s\S]*?to service_role/);
  const saveBody = editorAction.slice(editorAction.indexOf("export async function saveExamEdits"), editorAction.indexOf("export async function regenerateExamQuestion"));
  assert.match(saveBody, /return persist\(admin, exam, teacherId, expectedRevision/);
  assert.match(editorAction, /admin\.rpc\("update_exam_and_scheme_atomic"/);
});

test("question regeneration claims the owned slot before grounding or provider work", () => {
  assert.match(migration, /target_exam_id = p_exam_id and status = 'active'/);
  assert.match(migration, /target_exam_id = p_exam_id and[\s\S]*?status = 'active' and lease_expires_at <= now\(\)/);
  assert.match(migration, />= 50[\s\S]*?'quota_exceeded'/);
  const claim = regenerateBody.indexOf("claimQuestionRegeneration");
  assert.ok(claim < regenerateBody.indexOf("prepareRegenerationGrounding"));
  assert.ok(claim < regenerateBody.indexOf("await regenerateQuestion"));
});

test("regeneration is exam-exclusive while retaining slot audit context", () => {
  assert.match(migration, /ai_one_active_regeneration_per_exam[\s\S]*?\(target_exam_id\)/);
  assert.match(migration, /target_slot_id text/);
  assert.match(migration, /values \(p_teacher_id, 'regeneration', p_request_key, p_exam_id, p_slot_id/);
  assert.match(migration, /target_exam_id = p_exam_id and status = 'active'/);
  assert.doesNotMatch(migration, /target_exam_id = p_exam_id and target_slot_id = p_slot_id and status = 'active'/);
});

test("regeneration lease exceeds the complete execution window and expires only afterward", () => {
  const maximumOperationMs = AI_OPERATION_TIMING.serverActionMaximumSeconds * 1_000;
  const leaseMs = REGENERATION_LEASE_SECONDS * 1_000;
  assert.ok(leaseMs > maximumOperationMs);
  assert.equal(
    REGENERATION_LEASE_SECONDS,
    AI_OPERATION_TIMING.serverActionMaximumSeconds +
      Math.ceil(AI_OPERATION_TIMING.leaseSafetyMarginMs / 1_000)
  );
  assert.match(migration, new RegExp(`interval '${REGENERATION_LEASE_SECONDS} seconds'`));
  assert.match(migration, /status = 'active' and lease_expires_at <= now\(\)/);
  assert.equal(maximumOperationMs >= leaseMs, false, "same-slot lease remains active throughout valid execution");
  assert.equal(leaseMs + 1 > leaseMs, true, "lease is reclaimable after true expiry");
});

test("different exams remain independently claimable and completion or failure releases the exam lease", () => {
  assert.match(migration, /unique index ai_one_active_regeneration_per_exam[\s\S]*?on public\.ai_operation_reservations \(target_exam_id\)/);
  assert.doesNotMatch(migration, /unique index ai_one_active_regeneration_per_teacher/);
  assert.match(migration, /status = 'completed'.*lease_expires_at = now\(\)/);
  assert.match(migration, /status = 'failed'.*lease_expires_at = now\(\)/);
});

test("new regeneration rejects stale revisions inside the claim before quota, lease or provider work", () => {
  const claimRpc = migration.slice(
    migration.indexOf("create function public.claim_ai_regeneration"),
    migration.indexOf("create function public.persist_generated_exam_and_complete_ai_operation")
  );
  const revision = claimRpc.indexOf("revision = p_expected_revision");
  const quota = claimRpc.indexOf(">= 50");
  const insert = claimRpc.indexOf("insert into public.ai_operation_reservations");
  const claim = regenerateBody.indexOf("claimQuestionRegeneration");
  assert.ok(revision > 0 && revision < quota && quota < insert);
  assert.match(claimRpc, /return query select 'stale'/);
  assert.ok(claim < regenerateBody.indexOf("prepareRegenerationGrounding"));
  assert.match(editorAction, /finally \{[\s\S]*?failAiReservation\(teacherId, reservationId\)/);
});

test("slot and total provider-call budgets are derived from existing retry structure", () => {
  const maximum = assertGenerationProviderBudget(blueprintWithSlots(AI_ABUSE_LIMITS.maximumQuestionSlots));
  assert.equal(maximum.maximumProviderCalls, MAX_GENERATION_PROVIDER_CALLS);
  assert.throws(
    () => assertGenerationProviderBudget(blueprintWithSlots(AI_ABUSE_LIMITS.maximumQuestionSlots + 1)),
    (error) => error instanceof AiAbuseControlError && error.code === "BUDGET_EXCEEDED"
  );
});

test("regeneration timeout is capped and the overall deadline fails closed", () => {
  assert.equal(regenerationRequestTimeoutMs(1_000, 301_000), AI_ABUSE_LIMITS.regenerationProviderTimeoutMs);
  assert.equal(regenerationRequestTimeoutMs(1_000, 51_000), 50_000);
  assert.throws(() => regenerationRequestTimeoutMs(2_000, 2_000), AiAbuseControlError);
  assert.match(regenerationProvider, /AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(regenerationProvider, /regenerationBudgetMs/);
  assert.match(aiClient, /maxRetries: AI_CONFIG\.transportRetries/);
  assert.match(aiConfig, /transportRetries: 0/);
});

test("teacher identity is server-derived and reservation RPCs are service-role only", () => {
  assert.match(examAction, /\.eq\("user_id", user\.id\)/);
  assert.match(editorAction, /async function authenticatedTeacher/);
  assert.doesNotMatch(examAction, /data\.teacherId/);
  assert.match(migration, /revoke all on function public\.claim_ai_generation\(uuid, uuid\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.claim_ai_generation\(uuid, uuid\) to service_role/);
  assert.match(migration, /revoke all on public\.ai_operation_reservations from public, anon, authenticated/);
});
