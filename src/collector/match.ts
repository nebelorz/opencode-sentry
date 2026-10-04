import type { PricingEntry, SnapshotModel } from "../schema/snapshot.ts";
import { monthlyLimitCell, nameKey, priceCell, quotaCell } from "./normalize.ts";
import type { EndpointEntry, EstimatedRequestsTable, PricingRow } from "./parse.ts";

const PLANS = ["go", "go-plus"] as const;

function requiredPrice(raw: string, modelName: string): number {
  const value = priceCell(raw);
  if (value === null) {
    throw new Error(`Pricing for model "${modelName}" is missing a required price`);
  }
  return value;
}

export function matchModels(
  estimated: EstimatedRequestsTable,
  endpoints: EndpointEntry[],
  pricing: PricingRow[],
): SnapshotModel[] {
  const byKey = new Map<string, EndpointEntry>();
  for (const entry of endpoints) {
    const key = nameKey(entry.name);
    if (byKey.has(key)) {
      throw new Error(`Duplicate model name "${entry.name}" in Endpoints`);
    }
    byKey.set(key, entry);
  }

  const usedKeys = new Set<string>();
  const models: SnapshotModel[] = [];

  for (const row of estimated.rows) {
    const rawName = row[estimated.modelIndex] ?? "";
    const name = nameKey(rawName);

    if (name.length === 0) {
      throw new Error("Estimated requests row is missing a model name");
    }

    const entry = byKey.get(name);
    if (!entry) {
      throw new Error(`Model "${rawName}" has no Endpoints entry`);
    }
    if (usedKeys.has(name)) {
      throw new Error(`Model "${rawName}" matches more than one Estimated requests row`);
    }
    usedKeys.add(name);

    models.push({
      id: entry.id,
      name,
      estimatedRequests: {
        fiveHour: quotaCell(row[estimated.fiveHourIndex] ?? ""),
        weekly: quotaCell(row[estimated.weeklyIndex] ?? ""),
        monthly: quotaCell(row[estimated.monthlyIndex] ?? ""),
      },
    });
  }

  const byName = new Map<string, SnapshotModel>();
  for (const model of models) {
    byName.set(model.name, model);
  }

  for (const row of pricing) {
    const model = byName.get(nameKey(row.baseName));
    if (!model) {
      throw new Error(`Pricing model "${row.baseName}" has no snapshot model`);
    }

    const entry: PricingEntry = {
      plan: row.plan,
      variant: row.variant,
      variantLabel: row.variantLabel,
      input: requiredPrice(row.input, model.name),
      output: requiredPrice(row.output, model.name),
      cachedRead: priceCell(row.cachedRead),
      cachedWrite: priceCell(row.cachedWrite),
      monthlyLimit: monthlyLimitCell(row.monthlyLimit),
    };

    model.pricing = model.pricing ?? [];
    model.pricing.push(entry);
  }

  for (const model of models) {
    for (const plan of PLANS) {
      const hasPlan = model.pricing?.some((entry) => entry.plan === plan) ?? false;
      if (!hasPlan) {
        throw new Error(`Model "${model.name}" has no ${plan} pricing`);
      }
    }
  }

  return models;
}
