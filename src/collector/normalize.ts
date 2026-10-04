import type { MonthlyLimit, QuotaValue } from "../schema/snapshot.ts";

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

function unsignedNumber(raw: string, label: string): number {
  const withoutSeparators = raw.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(withoutSeparators)) {
    throw new Error(`Unsupported ${label} value "${raw}"`);
  }

  const value = Number(withoutSeparators);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Unsupported ${label} value "${raw}"`);
  }

  return value;
}

export function priceCell(raw: string): number | null {
  const trimmed = raw.trim();

  if (trimmed === "-") {
    return null;
  }
  if (/^free$/i.test(trimmed)) {
    return 0;
  }

  return unsignedNumber(trimmed.startsWith("$") ? trimmed.slice(1) : trimmed, "price");
}

export function monthlyLimitCell(raw: string): MonthlyLimit {
  const trimmed = raw.trim();

  if (/^unlimited/i.test(trimmed)) {
    return "unlimited";
  }

  const amount = unsignedNumber(
    trimmed.startsWith("$") ? trimmed.slice(1) : trimmed,
    "monthly limit",
  );
  return { amount, currency: "USD" };
}
