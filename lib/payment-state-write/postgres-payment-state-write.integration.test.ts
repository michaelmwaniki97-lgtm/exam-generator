import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, queryRows, withTrustedTransaction } from "../db/postgres-client.ts";
import { normalizePaymentAttempt } from "../payment-attempt-read/contracts.ts";
import { PostgresPaymentStateWriteRepository } from "./postgres.ts";

test("direct PostgreSQL payment-state writes preserve transitions, correlation, provider neutrality, and best-effort terminal behavior", async (context) => {
  const ids = {
    exams: [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()],
    accepted: randomUUID(), rejected: randomUUID(), terminal: randomUUID(), paid: randomUUID(), duplicate: randomUUID(),
  };
  let teacherId = "";
  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        await client.query("delete from public.payments where id = any($1::uuid[])", [[ids.accepted, ids.rejected, ids.terminal, ids.paid, ids.duplicate]]);
        await client.query("delete from public.exams where id = any($1::uuid[])", [ids.exams]);
      });
    } finally { await closePostgresPool(); }
  });
  await withTrustedTransaction(async (client) => {
    teacherId = (await queryRows<{ id: string }>(client,
      "select id from public.teachers where user_id = $1::uuid", ["00000000-0000-4000-8000-000000000001"]))[0]?.id ?? "";
    assert.ok(teacherId);
    for (const examId of ids.exams) {
      await client.query(
        `insert into public.exams (id, teacher_id, subject_id, grade_id, exam_type, marks, duration, difficulty, content, status, term, year)
         values ($1::uuid, $2::uuid, '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
           'State write fixture', 10, 20, 'easy', '{}'::jsonb, 'generated', 'Term 1', 2026)`, [examId, teacherId]);
    }
    for (const [id, examId, provider, status, code, description] of [
      [ids.accepted, ids.exams[0], "card", "initiated", null, null],
      [ids.rejected, ids.exams[1], "daraja", "initiated", null, null],
      [ids.terminal, ids.exams[2], "daraja", "pending", "existing-code", "existing-description"],
      [ids.paid, ids.exams[3], "card", "paid", null, null],
      [ids.duplicate, ids.exams[4], "card", "initiated", null, null],
    ]) {
      await client.query(
        `insert into public.payments
          (id, exam_id, teacher_id, amount, currency, phone, provider, status, verification_status,
           idempotency_key, result_code, result_description, external_request_id)
         values ($1::uuid, $2::uuid, $3::uuid, 100, 'KES', '254700000001', $4::text, $5::text,
           case when $5::text = 'paid' then 'verified' when $5::text = 'pending' then 'pending' else 'unverified' end,
           gen_random_uuid(), $6::text, $7::text,
           case when $1::uuid = $8::uuid then 'shared-external' else null end)`,
        [id, examId, teacherId, provider, status, code, description, ids.accepted]);
    }
  });

  const repository = new PostgresPaymentStateWriteRepository();
  const accepted = await repository.saveInitiation(ids.accepted, {
    status: "pending", verification_status: "pending", external_request_id: "card-session",
    provider_request_id: "card-intent", result_description: null,
    query_next_at: "2026-08-27T10:00:30.000Z", updated_at: "2026-08-27T10:00:00.000Z",
  });
  assert.ok(accepted);
  assert.deepEqual(normalizePaymentAttempt(accepted), {
    id: ids.accepted, examId: ids.exams[0], teacherId, amount: 100, currency: "KES",
    phone: "254700000001", provider: "card", status: "pending",
    externalRequestId: "card-session", providerRequestId: "card-intent", providerReference: null,
    createdAt: normalizePaymentAttempt(accepted).createdAt, completedAt: null,
  });
  assert.equal(await repository.saveInitiation(ids.accepted, {
    status: "failed", verification_status: "rejected", result_description: "must not overwrite pending",
    updated_at: "2026-08-27T10:01:00.000Z",
  }), null);

  const rejected = await repository.saveInitiation(ids.rejected, {
    status: "failed", verification_status: "rejected", result_description: "Provider rejected request",
    updated_at: "2026-08-27T10:02:00.000Z",
  });
  assert.equal(rejected?.status, "failed");
  assert.equal(rejected?.provider, "daraja");

  await repository.recordTerminal(ids.terminal, "expired", undefined, undefined, "2026-08-27T11:00:00.000Z");
  const terminal = await withTrustedTransaction(async (client) => (await queryRows<{
    status: string; verification_status: string; result_code: string | null; result_description: string | null;
  }>(client,
    "select status, verification_status, result_code, result_description from public.payments where id = $1::uuid",
    [ids.terminal]))[0]);
  assert.deepEqual(terminal, {
    status: "expired", verification_status: "rejected",
    result_code: "existing-code", result_description: "existing-description",
  });

  await repository.recordTerminal(ids.paid, "failed", "should-not-write", "should-not-write", new Date().toISOString());
  const paid = await withTrustedTransaction(async (client) => (await queryRows<{ status: string }>(client,
    "select status from public.payments where id = $1::uuid", [ids.paid]))[0]);
  assert.equal(paid?.status, "paid");

  // Provider-scoped unique correlation remains database-authoritative.
  assert.equal(await repository.saveInitiation(ids.duplicate, {
    status: "pending", verification_status: "pending", external_request_id: "card-session",
    provider_request_id: "other-intent", result_description: null,
    query_next_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }), null);

  const invariantRows = await withTrustedTransaction((client) => queryRows<{
    id: string; exam_id: string; teacher_id: string; amount: number; currency: string;
  }>(client,
    "select id, exam_id, teacher_id, amount, currency from public.payments where id = any($1::uuid[]) order by id",
    [[ids.accepted, ids.rejected, ids.terminal, ids.paid, ids.duplicate]]));
  assert.equal(invariantRows.length, 5);
  assert.ok(invariantRows.every((row) => ids.exams.includes(row.exam_id) && row.teacher_id === teacherId && row.amount === 100 && row.currency === "KES"));
});
