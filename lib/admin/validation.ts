export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NamedRow = { id: string; value: string };

export function cleanRequiredText(
  raw: FormDataEntryValue | null,
  label: string,
  maxLength = 180
): { value: string } | { error: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { error: `${label} is required.` };
  if (value.length > maxLength) {
    return { error: `${label} must be ${maxLength} characters or fewer.` };
  }
  return { value };
}

export function cleanRequiredMultiline(
  raw: FormDataEntryValue | null,
  label: string,
  maxLength = 1000
): { value: string } | { error: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { error: `${label} is required.` };
  if (value.length > maxLength) {
    return { error: `${label} must be ${maxLength} characters or fewer.` };
  }
  return { value };
}

export function cleanId(
  raw: FormDataEntryValue | null,
  label: string
): { value: string } | { error: string } {
  const value = String(raw ?? "");
  if (!UUID_PATTERN.test(value)) return { error: `Invalid ${label}.` };
  return { value };
}

export function hasDuplicate(rows: NamedRow[], value: string, excludeId?: string): boolean {
  const key = value.toLocaleLowerCase("en");
  return rows.some(
    (row) => row.id !== excludeId && row.value.toLocaleLowerCase("en") === key
  );
}
