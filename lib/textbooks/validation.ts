import { MAX_PDF_BYTES } from "./constants.ts";

export type UploadFileLike = { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };
export type SourceType = "school_supplied" | "publisher_authorized" | "oer" | "other_authorized";

export function safePdfFilename(name: string): string {
  const base = name.split(/[\\/]/).pop()?.replace(/\.pdf$/i, "") ?? "textbook";
  const safe = base.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `${safe || "textbook"}.pdf`;
}

export function validateUploadMetadata(file: UploadFileLike | null): string | null {
  if (!file) return "Select a PDF file.";
  if (typeof file.name !== "string" || typeof file.type !== "string" || typeof file.size !== "number" || typeof file.arrayBuffer !== "function")
    return "Select a valid PDF file.";
  if (file.size <= 0) return "The PDF file is empty.";
  if (file.size > MAX_PDF_BYTES) return "The PDF exceeds the 12 MiB upload limit.";
  if (file.type.toLowerCase() !== "application/pdf") return "Only PDF uploads are allowed.";
  if (!/\.pdf$/i.test(file.name)) return "The filename must use the .pdf extension.";
  return null;
}

export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export function isSourceType(value: string): value is SourceType {
  return ["school_supplied", "publisher_authorized", "oer", "other_authorized"].includes(value);
}
