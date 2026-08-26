import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { closePostgresPool, getPostgresPool, withTrustedTransaction } from "../db/postgres-client.ts";
import { PostgresTextbookReadRepository } from "./postgres.ts";

const TEACHER = "00000000-0000-4000-8000-000000000006";
const ADMIN_DUAL_ROLE = "00000000-0000-4000-8000-000000000005";
const UNKNOWN = "00000000-0000-4000-8000-000000000099";

test("direct PostgreSQL textbook reads preserve scope, readiness, privacy, and role boundaries", async (context) => {
  const ids = Object.fromEntries(["gradeA", "gradeB", "subjectA", "subjectB", "bookReady", "bookOtherGrade", "bookOtherSubject",
    "bookSameNamePublisher", "bookNoDocument", "bookTie", "readyOld", "readyNew", "processing", "failed", "readyNull", "tieA", "tieB"]
    .map((key) => [key, randomUUID()]));
  await withTrustedTransaction(async (client) => {
    await client.query("insert into public.grades(id,name,level,sort_order) values ($1,$2,'primary',910),($3,$4,'primary',911)",
      [ids.gradeA, `Textbook Grade A ${ids.gradeA.slice(0, 8)}`, ids.gradeB, `Textbook Grade B ${ids.gradeB.slice(0, 8)}`]);
    await client.query("insert into public.subjects(id,name) values ($1,$2),($3,$4)",
      [ids.subjectA, `Textbook Subject A ${ids.subjectA.slice(0, 8)}`, ids.subjectB, `Textbook Subject B ${ids.subjectB.slice(0, 8)}`]);
    await client.query(`insert into public.textbooks(id,subject_id,grade_id,name,publisher) values
      ($1,$6,$7,'Ready fixture',null),($2,$6,$8,'Ready fixture','Other grade publisher'),
      ($3,$9,$7,'Ready fixture','Other subject publisher'),($4,$6,$7,'Ready fixture','Different publisher'),
      ($5,$9,$7,'No document fixture',null),($10,$6,$7,'Tie fixture',null)`,
      [ids.bookReady, ids.bookOtherGrade, ids.bookOtherSubject, ids.bookSameNamePublisher, ids.bookNoDocument,
        ids.subjectA, ids.gradeA, ids.gradeB, ids.subjectB, ids.bookTie]);
    const uploadedBy = ADMIN_DUAL_ROLE;
    for (const [index, [id, textbookId, status, processedAt]] of ([
      [ids.readyOld, ids.bookReady, "ready", "2026-01-01T00:00:00Z"],
      [ids.readyNew, ids.bookReady, "ready", "2026-02-01T00:00:00Z"],
      [ids.processing, ids.bookReady, "processing", "2026-04-01T00:00:00Z"],
      [ids.failed, ids.bookReady, "failed", "2026-05-01T00:00:00Z"],
      [ids.readyNull, ids.bookReady, "ready", null],
      [ids.tieA, ids.bookTie, "ready", "2026-03-01T00:00:00Z"],
      [ids.tieB, ids.bookTie, "ready", "2026-03-01T00:00:00Z"],
    ] as const).entries()) {
      await client.query(`insert into public.textbook_documents
        (id,textbook_id,storage_path,original_filename,mime_type,file_size,content_sha256,processing_status,processing_error,
         page_count,chunk_count,source_type,authorization_acknowledged,uploaded_by,created_at,processed_at)
        values ($1,$2,$3,$4,'application/pdf',80,$5,$6,$7,$8,$9,'oer',true,$10,$11,$12)`,
        [id, textbookId, `textbooks/${textbookId}/${id}/fixture-${index}.pdf`, `fixture-${index}.pdf`, String(index + 1).repeat(64), status,
          status === "failed" ? "Synthetic failure" : null, status === "ready" ? index + 1 : null, status === "ready" ? index + 2 : null,
          uploadedBy, `2026-0${index + 1}-01T00:00:00Z`, processedAt]);
    }
  });
  context.after(async () => {
    try {
      await withTrustedTransaction(async (client) => {
        await client.query("delete from public.textbook_documents where textbook_id = any($1::uuid[])", [[ids.bookReady, ids.bookOtherGrade, ids.bookOtherSubject, ids.bookSameNamePublisher, ids.bookNoDocument, ids.bookTie]]);
        await client.query("delete from public.textbooks where id = any($1::uuid[])", [[ids.bookReady, ids.bookOtherGrade, ids.bookOtherSubject, ids.bookSameNamePublisher, ids.bookNoDocument, ids.bookTie]]);
        await client.query("delete from public.grades where id = any($1::uuid[])", [[ids.gradeA, ids.gradeB]]);
        await client.query("delete from public.subjects where id = any($1::uuid[])", [[ids.subjectA, ids.subjectB]]);
      });
    } finally { await closePostgresPool(); }
  });

  const admin = new PostgresTextbookReadRepository(ADMIN_DUAL_ROLE, "admin");
  const teacher = new PostgresTextbookReadRepository(TEACHER, "teacher");
  const unknownTeacher = new PostgresTextbookReadRepository(UNKNOWN, "teacher");
  const duplicateCandidates = await admin.listTextbooksForDuplicateCheck(ids.subjectA, ids.gradeA);
  assert.deepEqual(new Set(duplicateCandidates.map((row) => row.id)), new Set([ids.bookReady, ids.bookSameNamePublisher, ids.bookTie]));
  assert.ok(duplicateCandidates.filter((row) => row.name === "Ready fixture").length === 2, "publisher does not change the candidate duplicate rule");
  assert.deepEqual((await admin.listTextbooksForDuplicateCheck(ids.subjectA, ids.gradeB)).map((row) => row.id), [ids.bookOtherGrade]);
  assert.deepEqual((await admin.listTextbooksForDuplicateCheck(ids.subjectB, ids.gradeA)).map((row) => row.id).sort(), [ids.bookNoDocument, ids.bookOtherSubject].sort());
  assert.deepEqual(await admin.listTextbooksForDuplicateCheck(randomUUID(), randomUUID()), []);
  assert.equal(await admin.textbookExists(ids.bookReady), true);
  assert.equal(await admin.textbookExists(randomUUID()), false);
  const documents = (await admin.listAdminTextbookDocuments()).filter((row) => row.textbook_id === ids.bookReady);
  assert.equal(documents.length, 5);
  assert.ok(documents.every((row) => Object.keys(row).sort().join() === "chunk_count,created_at,file_size,id,original_filename,page_count,processing_error,processing_status,source_type,textbook_id"));
  assert.ok(documents.every((row) => typeof row.file_size === "number" && typeof row.created_at === "string"));
  assert.ok(!JSON.stringify(documents).includes("storage_path") && !JSON.stringify(documents).includes("uploaded_by"));

  assert.deepEqual(await teacher.getTextbookForGrounding(ids.bookReady, ids.subjectA, ids.gradeA), { id: ids.bookReady, name: "Ready fixture" });
  assert.equal(await teacher.getTextbookForGrounding(ids.bookReady, ids.subjectB, ids.gradeA), null);
  assert.equal(await teacher.getTextbookForGrounding(ids.bookReady, ids.subjectA, ids.gradeB), null);
  assert.equal(await teacher.getReadyDocumentId(ids.bookReady), ids.readyNull, "historical DESC ordering leaves PostgreSQL's default NULLS FIRST behavior intact");
  assert.equal(await teacher.getReadyDocumentId(ids.bookReady, ids.readyOld), ids.readyOld);
  assert.equal(await teacher.getReadyDocumentId(ids.bookReady, ids.processing), null);
  assert.equal(await teacher.getReadyDocumentId(ids.bookReady, ids.failed), null);
  assert.equal(await teacher.getReadyDocumentId(ids.bookNoDocument), null);
  assert.ok([ids.tieA, ids.tieB].includes((await teacher.getReadyDocumentId(ids.bookTie)) ?? ""), "equal newest timestamps have no historical tie-break winner");
  assert.equal(await teacher.getReadyDocumentId(ids.bookTie, ids.tieA), ids.tieA, "exact provenance remains pinned even when another document has the same timestamp");

  await assert.rejects(() => teacher.listAdminTextbookDocuments(), /Administrator access/);
  await assert.rejects(() => admin.getReadyDocumentId(ids.bookReady), /Teacher access/);
  await assert.rejects(() => unknownTeacher.getReadyDocumentId(ids.bookReady), /Teacher access/);
  await assert.rejects(() => getPostgresPool().query("select id from public.textbook_documents"), /permission denied/);
});
