export interface TextbookStorageProvider {
  put(key: string, bytes: Uint8Array, contentType: "application/pdf"): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

const UUID_PART = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
export const TEXTBOOK_STORAGE_KEY = new RegExp(`^textbooks/${UUID_PART}/${UUID_PART}/[^/]+\\.pdf$`);

export function assertTextbookStorageKey(key: string): void {
  if (!TEXTBOOK_STORAGE_KEY.test(key) || key.includes("..") || key.includes("\\")) {
    throw new Error("Invalid textbook storage key.");
  }
}
