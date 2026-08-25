import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../../supabase/migrations/20260826090000_add_payment_abuse_controls.sql", import.meta.url), "utf8");

test("initiation cooldowns and rolling caps are enforced before insert", () => {
  for (const term of [
    "interval '60 seconds'", "interval '5 minutes'", "interval '24 hours'",
    ">= 10", ">= 3", ">= 5", "payment teacher cooldown", "payment exam cooldown",
    "payment phone cooldown", "payment teacher daily limit", "payment exam daily limit", "payment phone daily limit",
  ]) assert.match(sql, new RegExp(term.replace(/[()]/g, "\\$&")));
  assert.ok(sql.indexOf("payment phone daily limit") < sql.indexOf("insert into public.payments"));
});

test("quota checks serialize teacher and phone decisions in a fixed order", () => {
  const teacherLock = sql.indexOf("hashtextextended(p_teacher_id::text, 1101)");
  const phoneLock = sql.indexOf("hashtextextended(p_phone, 1102)");
  assert.ok(teacherLock > 0 && phoneLock > teacherLock);
  assert.match(sql, /from public\.exams e where e\.id = p_exam_id for update/);
  assert.match(sql, /status in \('initiated', 'pending'\)[\s\S]*if found then return v_payment/);
});

test("query lease has initial delay, atomic claim, crash-safe budget, expiry recovery and backoff", () => {
  assert.match(sql, /coalesce\(query_next_at, initiated_at \+ interval '30 seconds'\) <= pg_catalog\.now\(\)/);
  assert.match(sql, /query_lease_until = pg_catalog\.now\(\) \+ interval '20 seconds'/);
  assert.match(sql, /query_attempt_count = query_attempt_count \+ 1/);
  assert.match(sql, /query_attempt_count < 8/);
  assert.match(sql, /query_lease_until is null or query_lease_until <= pg_catalog\.now\(\)/);
  for (const delay of ["30 seconds", "60 seconds", "120 seconds", "300 seconds"]) assert.match(sql, new RegExp(`interval '${delay}'`));
});

test("terminal and paid attempts cannot acquire a provider-query lease", () => {
  assert.match(sql, /where id = p_payment_id\s+and status in \('initiated', 'pending'\)\s+and external_request_id is not null/);
});

test("new RPCs are security-definer, hardened and service-role only", () => {
  for (const name of ["acquire_payment_query_lease", "complete_payment_query_lease"]) {
    assert.match(sql, new RegExp(`create function public\\.${name}`));
    assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\(uuid, uuid\\) from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(uuid, uuid\\) to service_role`));
  }
  assert.equal((sql.match(/security definer set search_path = pg_catalog/g) ?? []).length, 3);
});

test("migration is additive and leaves finalization and existing rows untouched", () => {
  assert.doesNotMatch(sql, /drop\s+(?:table|column|constraint|function)|truncate|delete\s+from/i);
  assert.doesNotMatch(sql, /create(?: or replace)? function public\.finalize_verified_payment/);
  const beforeFunctions = sql.slice(0, sql.indexOf("create or replace function"));
  assert.doesNotMatch(beforeFunctions, /update\s+public\.payments/i);
  assert.match(sql, /query_attempt_count integer not null default 0/);
  assert.match(sql, /query_lease_token is null and query_lease_until is null/);
});
