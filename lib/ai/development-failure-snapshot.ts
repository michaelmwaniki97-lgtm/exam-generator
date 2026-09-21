import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExamBlueprint } from "../blueprint/types";
import { redactedExamValidationSnapshot, type FinalValidationDiagnostics, type GeneratedExam, type TextbookGroundingContext } from "./generation-core";

/** Writes only redacted validation metadata and is deliberately unavailable in production. */
export async function saveDevelopmentFailureSnapshot(exam: GeneratedExam, blueprint: ExamBlueprint, diagnostics: FinalValidationDiagnostics, textbookContext?: TextbookGroundingContext): Promise<string | undefined> {
  if (process.env.NODE_ENV !== "development") return undefined;
  const directory = join(process.cwd(), "tmp", "ai-generation-debug");
  const filename = `failed-exam-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), JSON.stringify({
    createdAt: new Date().toISOString(),
    // The complete generated exam stays in this ignored, development-only local artifact
    // so validators and the PDF renderer can replay it with no provider call. It is never logged.
    exam,
    blueprint,
    groundingManifest: textbookContext ? { textbookId: textbookContext.textbookId, chunks: textbookContext.chunks.map(({ chunkId, documentId, pageStart, pageEnd }) => ({ chunkId, documentId, pageStart, pageEnd })) } : undefined,
    redacted: redactedExamValidationSnapshot(exam, blueprint, diagnostics),
  }, null, 2), { encoding: "utf8", mode: 0o600 });
  return filename;
}


/** Stores a rejected compact visual locally for offline replay; never used in production or logs. */
export async function saveDevelopmentRejectedVisualSnapshot(input: { batchIndex: number; retryNumber: number; slotId: string; compactVisual: unknown; error: string; reason: string }): Promise<string | undefined> {
  if (process.env.NODE_ENV !== "development") return undefined;
  const directory = join(process.cwd(), "tmp", "ai-generation-debug");
  const filename = `rejected-visual-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const envelope = input.compactVisual && typeof input.compactVisual === "object" && !Array.isArray(input.compactVisual) ? input.compactVisual as Record<string, unknown> : undefined;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), JSON.stringify({ createdAt: new Date().toISOString(), slotId: input.slotId, batchIndex: input.batchIndex, retryNumber: input.retryNumber, reason: input.reason, error: input.error, compactVisual: input.compactVisual, structural: { visualKind: typeof envelope?.kind === "string" ? envelope.kind : undefined, envelopeKeys: envelope ? Object.keys(envelope).sort() : [] } }, null, 2), { encoding: "utf8", mode: 0o600 });
  return filename;
}

/** Stores a rejected marking payload locally for offline replay; never used in production or logs. */
export async function saveDevelopmentRejectedMarkingSnapshot(input: { entryIndex: number; slotId: string; retryNumber: number; marking: unknown; error: string; reason: string; question: { text: string; marks: number; visual: unknown; stimulusTypes: string[] } }): Promise<string | undefined> {
  if (process.env.NODE_ENV !== "development") return undefined;
  const directory = join(process.cwd(), "tmp", "ai-generation-debug");
  const filename = `rejected-marking-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), JSON.stringify({ createdAt: new Date().toISOString(), ...input }, null, 2), { encoding: "utf8", mode: 0o600 });
  return filename;
}
