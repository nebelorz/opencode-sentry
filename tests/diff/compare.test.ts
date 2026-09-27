import { describe, expect, it } from "vitest";

import { compareSnapshots } from "../../src/diff/compare";
import type { Change } from "../../src/schema/change";
import type { QuotaValue, Snapshot, SnapshotModel } from "../../src/schema/snapshot";

const source = {
  provider: "opencode",
  plan: "go",
  url: "https://opencode.ai/v2/docs/console/go",
} as const;

function model(
  id: string,
  name: string,
  [fiveHour, weekly, monthly]: [QuotaValue, QuotaValue, QuotaValue],
): SnapshotModel {
  return { id, name, estimatedRequests: { fiveHour, weekly, monthly } };
}

function snapshot(scrapedAt: string, models: SnapshotModel[]): Snapshot {
  return { schemaVersion: 1, source, scrapedAt, models };
}

function key(change: Change): string {
  return change.type === "quota_changed"
    ? `${change.type}:${change.model.id}:${change.quota.period}`
    : `${change.type}:${change.model.id}`;
}

const earlier = "2026-09-27T10:00:00.000Z";
const later = "2026-09-27T11:00:00.000Z";

describe("compareSnapshots", () => {
  it("returns no changes for equivalent snapshots", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("a", "Alpha", [100, 200, 300])]),
      snapshot(later, [model("a", "Alpha", [100, 200, 300])]),
    );

    expect(changes).toEqual([]);
  });

  it("reports a single added model with its complete current quota values", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("a", "Alpha", [1, 2, 3])]),
      snapshot(later, [model("a", "Alpha", [1, 2, 3]), model("b", "Bravo", [10, 20, 30])]),
    );

    expect(changes).toEqual([
      {
        type: "model_added",
        model: { id: "b", name: "Bravo" },
        estimatedRequests: { fiveHour: 10, weekly: 20, monthly: 30 },
      },
    ]);
  });

  it("reports a single removed model with its previous quota values", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("a", "Alpha", [1, 2, 3]), model("b", "Bravo", [10, 20, 30])]),
      snapshot(later, [model("a", "Alpha", [1, 2, 3])]),
    );

    expect(changes).toEqual([
      {
        type: "model_removed",
        model: { id: "b", name: "Bravo" },
        previousEstimatedRequests: { fiveHour: 10, weekly: 20, monthly: 30 },
      },
    ]);
  });

  it("reports multiple added models individually ordered by id", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("a", "Alpha", [1, 2, 3])]),
      snapshot(later, [
        model("a", "Alpha", [1, 2, 3]),
        model("c", "Charlie", [1, 1, 1]),
        model("b", "Bravo", [1, 1, 1]),
      ]),
    );

    expect(changes.map((change) => change.model.id)).toEqual(["b", "c"]);
    expect(changes.every((change) => change.type === "model_added")).toBe(true);
  });

  it("reports multiple removed models individually ordered by id", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [
        model("a", "Alpha", [1, 2, 3]),
        model("c", "Charlie", [1, 1, 1]),
        model("b", "Bravo", [1, 1, 1]),
      ]),
      snapshot(later, [model("a", "Alpha", [1, 2, 3])]),
    );

    expect(changes.map((change) => change.model.id)).toEqual(["b", "c"]);
    expect(changes.every((change) => change.type === "model_removed")).toBe(true);
  });

  it("does not report models present in both snapshots as added or removed", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("a", "Alpha", [1, 2, 3]), model("b", "Bravo", [4, 5, 6])]),
      snapshot(later, [model("a", "Alpha", [1, 2, 3]), model("b", "Bravo", [4, 5, 6])]),
    );

    expect(changes).toEqual([]);
  });

  it("matches models by id and not by name", () => {
    const renamed = compareSnapshots(
      snapshot(earlier, [model("a", "Alpha", [1, 2, 3])]),
      snapshot(later, [model("a", "Renamed", [1, 2, 3])]),
    );

    expect(renamed).toEqual([]);

    const differentIds = compareSnapshots(
      snapshot(earlier, [model("a", "Same Name", [1, 2, 3])]),
      snapshot(later, [model("b", "Same Name", [1, 2, 3])]),
    );

    expect(differentIds.map(key)).toEqual(["model_added:b", "model_removed:a"]);
  });

  it("computes numeric changes and percentages for every period", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("m", "Model", [100, 200, 300])]),
      snapshot(later, [model("m", "Model", [150, 250, 350])]),
    );

    expect(changes).toEqual([
      {
        type: "quota_changed",
        model: { id: "m", name: "Model" },
        quota: {
          period: "fiveHour",
          previous: 100,
          current: 150,
          change: 50,
          changePercent: 50,
        },
      },
      {
        type: "quota_changed",
        model: { id: "m", name: "Model" },
        quota: {
          period: "weekly",
          previous: 200,
          current: 250,
          change: 50,
          changePercent: 25,
        },
      },
      {
        type: "quota_changed",
        model: { id: "m", name: "Model" },
        quota: {
          period: "monthly",
          previous: 300,
          current: 350,
          change: 50,
          changePercent: 16.67,
        },
      },
    ]);
  });

  it("reports quota changes for multiple models individually ordered by id", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("b", "Bravo", [1, 1, 1]), model("a", "Alpha", [1, 1, 1])]),
      snapshot(later, [model("b", "Bravo", [2, 1, 1]), model("a", "Alpha", [2, 1, 1])]),
    );

    expect(changes.map(key)).toEqual(["quota_changed:a:fiveHour", "quota_changed:b:fiveHour"]);
  });

  it("yields a null changePercent when the previous value is zero", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("m", "Model", [0, 0, 0])]),
      snapshot(later, [model("m", "Model", [100, 0, 0])]),
    );

    expect(changes).toEqual([
      {
        type: "quota_changed",
        model: { id: "m", name: "Model" },
        quota: {
          period: "fiveHour",
          previous: 0,
          current: 100,
          change: 100,
          changePercent: null,
        },
      },
    ]);
  });

  it("computes a numeric change and percentage when the current value is zero", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("m", "Model", [100, 1, 1])]),
      snapshot(later, [model("m", "Model", [0, 1, 1])]),
    );

    expect(changes).toEqual([
      {
        type: "quota_changed",
        model: { id: "m", name: "Model" },
        quota: {
          period: "fiveHour",
          previous: 100,
          current: 0,
          change: -100,
          changePercent: -100,
        },
      },
    ]);
  });

  it("represents a numeric to unlimited transition as a change with null numbers", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("m", "Model", [100, 1, 1])]),
      snapshot(later, [model("m", "Model", ["unlimited", 1, 1])]),
    );

    expect(changes).toEqual([
      {
        type: "quota_changed",
        model: { id: "m", name: "Model" },
        quota: {
          period: "fiveHour",
          previous: 100,
          current: "unlimited",
          change: null,
          changePercent: null,
        },
      },
    ]);
  });

  it("represents an unlimited to numeric transition as a change with null numbers", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("m", "Model", ["unlimited", 1, 1])]),
      snapshot(later, [model("m", "Model", [100, 1, 1])]),
    );

    expect(changes).toEqual([
      {
        type: "quota_changed",
        model: { id: "m", name: "Model" },
        quota: {
          period: "fiveHour",
          previous: "unlimited",
          current: 100,
          change: null,
          changePercent: null,
        },
      },
    ]);
  });

  it("treats an unlimited to unlimited transition as no change", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("m", "Model", ["unlimited", 1, 1])]),
      snapshot(later, [model("m", "Model", ["unlimited", 1, 1])]),
    );

    expect(changes).toEqual([]);
  });

  it("never produces non-finite values", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [model("m", "Model", [0, 100, "unlimited"])]),
      snapshot(later, [model("m", "Model", ["unlimited", 0, 100])]),
    );

    const numbers = changes.flatMap((change) => {
      if (change.type !== "quota_changed") {
        return [];
      }
      return [change.quota.change, change.quota.changePercent];
    });

    for (const value of numbers) {
      if (value !== null) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("orders changes by category, then model id, then period", () => {
    const changes = compareSnapshots(
      snapshot(earlier, [
        model("a", "Alpha", [100, 200, 300]),
        model("b", "Bravo", [10, 20, 30]),
        model("c", "Charlie", [1, 2, 3]),
      ]),
      snapshot(later, [
        model("a", "Alpha", [100, 250, 300]),
        model("c", "Charlie", [5, 2, 3]),
        model("d", "Delta", [7, 8, 9]),
      ]),
    );

    expect(changes.map(key)).toEqual([
      "model_added:d",
      "model_removed:b",
      "quota_changed:a:weekly",
      "quota_changed:c:fiveHour",
    ]);
  });

  it("produces the same ordering for repeated comparisons", () => {
    const previous = snapshot(earlier, [
      model("a", "Alpha", [100, 200, 300]),
      model("b", "Bravo", [10, 20, 30]),
    ]);
    const latest = snapshot(later, [
      model("a", "Alpha", [150, 200, 300]),
      model("c", "Charlie", [1, 2, 3]),
    ]);

    const first = compareSnapshots(previous, latest);
    const second = compareSnapshots(previous, latest);

    expect(second).toEqual(first);
  });
});
