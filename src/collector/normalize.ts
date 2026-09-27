import type { QuotaValue } from "../schema/snapshot.ts";

export function nameKey(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function quotaCell(raw: string): QuotaValue {
  const trimmed = raw.trim();

  if (/^unlimited$/i.test(trimmed)) {
    return "unlimited";
  }

  const withoutSeparators = trimmed.replace(/,/g, "");

  if (!/^-?\d+$/.test(withoutSeparators)) {
    throw new Error(`Unsupported quota value "${raw}"`);
  }

  const value = Number(withoutSeparators);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Unsupported quota value "${raw}"`);
  }

  return value;
}
