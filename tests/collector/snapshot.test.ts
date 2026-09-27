import { describe, expect, it } from "vitest";

import { buildSnapshot, SOURCE_URL } from "../../src/collector/snapshot";
import type { SnapshotModel } from "../../src/schema/snapshot";

const scrapedAt = new Date("2026-09-27T12:15:30.000Z");

const models: SnapshotModel[] = [
  {
    id: "opencode/kimi-k2.5",
    name: "Kimi K2.5",
    estimatedRequests: {
      fiveHour: 1500,
      weekly: 12000,
      monthly: "unlimited",
    },
  },
];

describe("buildSnapshot", () => {
  it("populates snapshot metadata", () => {
    const snapshot = buildSnapshot(models, scrapedAt);

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.source).toEqual({
      provider: "opencode",
      plan: "go",
      url: SOURCE_URL,
    });
    expect(snapshot.scrapedAt).toBe("2026-09-27T12:15:30.000Z");
  });

  it("strips a fragment from the source URL", () => {
    const snapshot = buildSnapshot(models, scrapedAt, `${SOURCE_URL}#estimated-requests`);

    expect(snapshot.source.url).toBe(SOURCE_URL);
  });

  it("keeps the Endpoints-sourced id", () => {
    const snapshot = buildSnapshot(models, scrapedAt);

    expect(snapshot.models[0]?.id).toBe("opencode/kimi-k2.5");
  });

  it("stores no endpoint metadata", () => {
    const snapshot = buildSnapshot(models, scrapedAt);

    expect(Object.keys(snapshot.models[0] ?? {}).sort()).toEqual([
      "estimatedRequests",
      "id",
      "name",
    ]);
    expect(JSON.stringify(snapshot)).not.toMatch(/endpoint|aiSdk|package/i);
  });

  it("rejects a schema-invalid candidate", () => {
    expect(() => buildSnapshot([], scrapedAt)).toThrow();
  });
});
