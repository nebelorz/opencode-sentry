import type { SnapshotModel } from "../schema/snapshot";
import { nameKey, quotaCell } from "./normalize";
import type { EndpointEntry, EstimatedRequestsTable } from "./parse";

export function matchModels(
  estimated: EstimatedRequestsTable,
  endpoints: EndpointEntry[],
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

  return models;
}
