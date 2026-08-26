import "server-only";
import { getCurrentUser } from "../auth/session";
import { getExamDocumentReadContext } from "../exam-read";
import { buildExamDocument, type ExamDocumentKind } from "./model";
import { getExamDownloadEntitlement } from "../payments/server";
import { INVALID_STORED_CONTENT_MESSAGE } from "../exam-editor/core";

export class ExamDocumentAccessError extends Error { constructor(public status: 401 | 402 | 403 | 404 | 422, message: string) { super(message); } }

export async function loadCanonicalExamDocument(id: string, kind: ExamDocumentKind, options: { requirePaid?: boolean } = {}) {
  const user = await getCurrentUser(); if (!user) throw new ExamDocumentAccessError(401, "Authentication required.");
  const { repository } = await getExamDocumentReadContext();
  const metadata = await repository.getDocumentAccessMetadata(id);
  if (!metadata) throw new ExamDocumentAccessError(404, "Exam not found.");
  if (options.requirePaid) {
    const entitlement = await getExamDownloadEntitlement(id);
    if (!entitlement.allowed) throw new ExamDocumentAccessError(402, "Payment is required before downloading this exam package.");
  }
  const exam = await repository.getAuthorizedExamDocument(id, kind === "marking");
  if (!exam) throw new ExamDocumentAccessError(404, "Exam not found.");
  const teacherRow = exam.teachers as unknown as { school: string | null } | null;
  const schemes = exam.marking_schemes as unknown as Array<{ content: unknown }>;
  if (kind === "marking" && schemes?.length !== 1) throw new ExamDocumentAccessError(422, "This exam does not have one compatible marking scheme.");
  try {
    return buildExamDocument({ id: exam.id, examType: exam.exam_type, marks: exam.marks, duration: exam.duration, term: exam.term, year: exam.year, school: teacherRow?.school ?? null, content: exam.content, markingContent: schemes?.[0]?.content }, kind);
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_STORED_CONTENT_MESSAGE) {
      throw new ExamDocumentAccessError(422, "This exam contains unsupported or invalid stored content and cannot be rendered safely.");
    }
    throw error;
  }
}
