import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { betterAuth } from "better-auth";
import { buildBetterAuthOptions } from "../lib/better-auth/options.ts";
import { provisionBetterAuthApplicationIdentity } from "../lib/better-auth/application-bridge.ts";
import { closeBetterAuthPool } from "../lib/better-auth/pool.ts";
import { PostgresTrustedRpcDatabase } from "../lib/db/postgres-rpc.ts";
import { closePostgresPool } from "../lib/db/postgres-client.ts";
import { PostgresExamReadRepository } from "../lib/exam-read/postgres.ts";
import { PostgresPaymentStateWriteRepository } from "../lib/payment-state-write/postgres.ts";
import { modernInput } from "../lib/exam-document/fixtures.ts";
import { bootstrapDatabaseUrl } from "./bootstrap-local-admin.mjs";
import { assertSafeLocalDatabaseUrl } from "./migrate-local-postgres.mjs";

const { Pool } = pg;
let activeStage = "startup";

function cookiesFrom(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  const cookie = values.map((value) => value.split(";", 1)[0]).join("; ");
  if (!cookie) throw new Error("Login did not return a session cookie.");
  return cookie;
}

async function expectStatus(origin, route, cookie, expected) {
  const response = await fetch(`${origin}${route}`, { redirect: "manual", headers: cookie ? { cookie } : undefined });
  assert.equal(response.status, expected, `${route} returned HTTP ${response.status}; expected ${expected}`);
  return response;
}

async function main() {
  activeStage = "configuration";
  const { database } = assertSafeLocalDatabaseUrl(process.env.DATABASE_URL, process.env);
  assert.equal(database, "exam_generator");
  const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  assert.equal(origin, "http://localhost:3000");

  const auth = betterAuth({ ...buildBetterAuthOptions(), plugins: [] });
  const operator = new Pool({ connectionString: bootstrapDatabaseUrl(process.env) });
  const email = `local-core-${randomUUID()}@example.test`;
  const password = randomBytes(32).toString("base64url");
  const trusted = new PostgresTrustedRpcDatabase();
  let userId;
  let teacherId;
  let examId;

  try {
    activeStage = "identity";
    const signup = await auth.api.signUpEmail({ body: { name: "Local Core Teacher", email, password } });
    assert.ok(signup.user?.id);
    userId = signup.user.id;
    await provisionBetterAuthApplicationIdentity({
      userId,
      email,
      name: "Local Core Teacher",
      school: "Local Core School",
      phone: "+254700000010",
    });
    teacherId = (await operator.query(
      "select id::text from public.teachers where user_id = $1::uuid",
      [userId],
    )).rows[0]?.id;
    assert.ok(teacherId);

    activeStage = "login";
    const login = await fetch(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email, password, rememberMe: true }),
    });
    assert.equal(login.status, 200);
    const cookie = cookiesFrom(login);

    activeStage = "curriculum";
    const curriculum = (await operator.query(`
      select st.subject_id::text, st.grade_id::text, s.name as subject_name,
             g.name as grade_name, g.level,
             (select count(*)::int from public.strands scoped
               where scoped.subject_id = st.subject_id and scoped.grade_id = st.grade_id) as strand_count
        from public.strands st
        join public.subjects s on s.id = st.subject_id
        join public.grades g on g.id = st.grade_id
       order by g.sort_order nulls last, g.name, s.name
       limit 1
    `)).rows[0];
    assert.ok(curriculum && curriculum.strand_count > 0);
    await expectStatus(origin, "/teacher/exams/new", cookie, 200);

    activeStage = "ai-boundary";
    delete process.env.AI_PROVIDER;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    const { generateExam } = await import("../lib/ai/generate-exam.ts");
    await assert.rejects(() => generateExam({}), /NVIDIA_API_KEY is not set/);
    const unavailableClaim = (await trusted.claimAiGeneration({ teacherId, requestKey: randomUUID() }))[0];
    assert.equal(unavailableClaim.outcome, "acquired");
    assert.equal(await trusted.failAiOperation({ teacherId, reservationId: unavailableClaim.reservation_id }), true);

    activeStage = "exam-persistence";
    const fixture = modernInput();
    fixture.content.meta.subjectName = curriculum.subject_name;
    fixture.content.meta.gradeName = curriculum.grade_name;
    fixture.content.meta.level = curriculum.level;
    const generationKey = randomUUID();
    const generation = (await trusted.claimAiGeneration({ teacherId, requestKey: generationKey }))[0];
    assert.equal(generation.outcome, "acquired");
    examId = await trusted.persistGeneratedExam({
      teacherId,
      reservationId: generation.reservation_id,
      requestKey: generationKey,
      subjectId: curriculum.subject_id,
      gradeId: curriculum.grade_id,
      examType: fixture.examType,
      marks: fixture.marks,
      duration: fixture.duration,
      difficulty: "medium",
      term: fixture.term,
      year: fixture.year,
      examContent: fixture.content,
      markingContent: fixture.markingContent,
    });

    const reads = new PostgresExamReadRepository(userId, teacherId, "teacher");
    assert.ok((await reads.listTeacherExams()).some((row) => row.id === examId));
    assert.equal((await reads.getTeacherExamForEditing(examId))?.marking_schemes.length, 1);
    await expectStatus(origin, `/teacher/exams/${examId}`, cookie, 200);
    await expectStatus(origin, `/teacher/exams/${examId}/marking-scheme`, cookie, 200);
    await expectStatus(origin, `/teacher/exams/${examId}/edit`, cookie, 200);

    activeStage = "editor";
    assert.equal(await trusted.updateExamAndSchemeAtomic({
      examId,
      teacherId,
      expectedRevision: 1,
      examContent: fixture.content,
      markingContent: fixture.markingContent,
    }), 2);
    const regenerationKey = randomUUID();
    const regeneration = (await trusted.claimAiRegeneration({
      teacherId,
      examId,
      slotId: "slot-1",
      requestKey: regenerationKey,
      expectedRevision: 2,
    }))[0];
    assert.equal(regeneration.outcome, "acquired");
    const { regenerateQuestion } = await import("../lib/exam-editor/regenerate-question.ts");
    await assert.rejects(() => regenerateQuestion({}), /NVIDIA_API_KEY is not set/);
    assert.equal(await trusted.failAiOperation({ teacherId, reservationId: regeneration.reservation_id }), true);

    activeStage = "payment-boundary";
    for (const name of [
      "PAYMENT_PROVIDER", "MPESA_ENVIRONMENT", "MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET",
      "MPESA_BUSINESS_SHORTCODE", "MPESA_PASSKEY", "MPESA_CALLBACK_URL",
    ]) delete process.env[name];
    const { configuredPaymentProvider, paymentProviderState } = await import("../lib/payments/provider-config.ts");
    assert.equal(paymentProviderState().configured, false);
    assert.throws(() => configuredPaymentProvider());
    await expectStatus(origin, `/api/exams/${examId}/pdf?kind=student`, cookie, 402);

    const payment = await trusted.beginPaymentAttempt({
      examId,
      teacherId,
      phone: "254700000010",
      provider: "daraja",
      idempotencyKey: randomUUID(),
    });
    const configuredPrice = Number((await operator.query(
      "select value->>'amount' as amount from public.app_settings where key = 'exam_package_price'",
    )).rows[0]?.amount);
    assert.equal(Number(payment.amount), configuredPrice);
    const pending = await new PostgresPaymentStateWriteRepository().saveInitiation(String(payment.id), {
      status: "pending",
      verification_status: "pending",
      external_request_id: `local-${randomUUID()}`,
      provider_request_id: `local-${randomUUID()}`,
      result_description: "Disposable local verification",
      query_next_at: new Date(Date.now() + 30_000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    assert.equal(pending?.status, "pending");
    assert.equal(await trusted.finalizeVerifiedPayment({
      paymentId: String(payment.id),
      examId,
      teacherId,
      provider: "daraja",
      amount: configuredPrice,
      currency: "KES",
      providerReference: `local-verification-${randomUUID()}`,
      providerReceipt: `L${randomUUID().replaceAll("-", "").slice(0, 20)}`,
      resultCode: "0",
      resultDescription: "Disposable local verification",
    }), true);

    activeStage = "pdf";
    for (const kind of ["student", "marking"]) {
      const response = await expectStatus(origin, `/api/exams/${examId}/pdf?kind=${kind}`, cookie, 200);
      assert.equal(response.headers.get("content-type"), "application/pdf");
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.ok(bytes.length > 1_000);
      assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
    }
    await expectStatus(origin, "/teacher/transactions", cookie, 200);

    console.log(JSON.stringify({
      database,
      curriculumSelection: "PASS",
      examWizardRoute: "PASS",
      aiProviderBoundary: "BLOCKED_UNCONFIGURED_NO_NETWORK_CALL",
      generationReservationCleanup: "PASS",
      examPersistence: "PASS",
      markingSchemePersistence: "PASS",
      examPreviewRoutes: "PASS",
      editorAtomicSave: "PASS",
      questionRegenerationBoundary: "BLOCKED_UNCONFIGURED_NO_NETWORK_CALL",
      paymentProviderBoundary: "BLOCKED_UNCONFIGURED_NO_NETWORK_CALL",
      paymentServerPrice: "PASS",
      paymentPendingState: "PASS",
      paymentTrustedFinalization: "PASS",
      studentPdf: "PASS",
      markingPdf: "PASS",
      transactionHistoryRoute: "PASS",
    }, null, 2));
  } finally {
    if (examId) {
      try { await operator.query("delete from public.payments where exam_id = $1::uuid", [examId]); } catch { /* disposable cleanup */ }
      try { await operator.query("delete from public.exams where id = $1::uuid", [examId]); } catch { /* disposable cleanup */ }
    }
    if (userId) {
      try { await operator.query("delete from public.admins where user_id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
      try { await operator.query("delete from public.teachers where user_id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
      try { await operator.query("delete from auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
      try { await operator.query("delete from better_auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    }
    await operator.end();
    await closePostgresPool();
    await closeBetterAuthPool();
  }
}

main().catch((error) => {
  console.error(`Local core verification failed during ${activeStage}: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
