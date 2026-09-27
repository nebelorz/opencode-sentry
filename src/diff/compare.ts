import type { Change } from "../schema/change.ts";
import type { QuotaValue, Snapshot, SnapshotModel } from "../schema/snapshot.ts";

const periods = ["fiveHour", "weekly", "monthly"] as const;

type Period = (typeof periods)[number];

function compareIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

function indexById(models: SnapshotModel[]): Map<string, SnapshotModel> {
  const index = new Map<string, SnapshotModel>();
  for (const model of models) {
    index.set(model.id, model);
  }
  return index;
}

function quotaChange(
  model: SnapshotModel,
  period: Period,
  previous: QuotaValue,
  current: QuotaValue,
): Change | undefined {
  if (previous === current) {
    return undefined;
  }

  if (previous === "unlimited" || current === "unlimited") {
    return {
      type: "quota_changed",
      model: { id: model.id, name: model.name },
      quota: { period, previous, current, change: null, changePercent: null },
    };
  }

  const change = current - previous;
  const changePercent = previous === 0 ? null : Math.round((change / previous) * 10000) / 100;

  return {
    type: "quota_changed",
    model: { id: model.id, name: model.name },
    quota: { period, previous, current, change, changePercent },
  };
}

export function compareSnapshots(previous: Snapshot, latest: Snapshot): Change[] {
  const previousModels = indexById(previous.models);
  const latestModels = indexById(latest.models);

  const added: Change[] = [...latestModels.values()]
    .filter((model) => !previousModels.has(model.id))
    .sort((a, b) => compareIds(a.id, b.id))
    .map((model): Change => {
      return {
        type: "model_added",
        model: { id: model.id, name: model.name },
        estimatedRequests: model.estimatedRequests,
      };
    });

  const removed: Change[] = [...previousModels.values()]
    .filter((model) => !latestModels.has(model.id))
    .sort((a, b) => compareIds(a.id, b.id))
    .map((model): Change => {
      return {
        type: "model_removed",
        model: { id: model.id, name: model.name },
        previousEstimatedRequests: model.estimatedRequests,
      };
    });

  const changed: Change[] = [];
  const shared = [...latestModels.values()].sort((a, b) => compareIds(a.id, b.id));

  for (const model of shared) {
    const previousModel = previousModels.get(model.id);
    if (!previousModel) {
      continue;
    }
    for (const period of periods) {
      const change = quotaChange(
        model,
        period,
        previousModel.estimatedRequests[period],
        model.estimatedRequests[period],
      );
      if (change) {
        changed.push(change);
      }
    }
  }

  return [...added, ...removed, ...changed];
}
