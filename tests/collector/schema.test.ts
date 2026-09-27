import { describe, expect, it } from "vitest";

import { snapshotSchema } from "../../src/schema/snapshot";

const source = {
  provider: "opencode",
  plan: "go",
  url: "https://opencode.ai/v2/docs/console/go",
};

const validSnapshot = {
  schemaVersion: 1,
  source,
  scrapedAt: "2026-09-27T12:15:00.000Z",
  models: [
    {
      id: "opencode/kimi-k2.5",
      name: "Kimi K2.5",
      estimatedRequests: {
        fiveHour: 1500,
        weekly: "unlimited",
        monthly: 40000,
      },
    },
  ],
};

describe("snapshot schema", () => {
  it("accepts a valid snapshot including an unlimited value", () => {
    const parsed = snapshotSchema.parse(validSnapshot);

    expect(parsed.models[0]?.estimatedRequests.weekly).toBe("unlimited");
  });

  it("rejects a missing quota period", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          id: "opencode/kimi-k2.5",
          name: "Kimi K2.5",
          estimatedRequests: {
            fiveHour: 1500,
            weekly: 12000,
          },
        },
      ],
    };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });

  it("rejects a negative value", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          id: "opencode/kimi-k2.5",
          name: "Kimi K2.5",
          estimatedRequests: {
            fiveHour: -1,
            weekly: 12000,
            monthly: 40000,
          },
        },
      ],
    };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });

  it("rejects a decimal value", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          id: "opencode/kimi-k2.5",
          name: "Kimi K2.5",
          estimatedRequests: {
            fiveHour: 1.5,
            weekly: 12000,
            monthly: 40000,
          },
        },
      ],
    };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });

  it("rejects an empty models array", () => {
    const candidate = { ...validSnapshot, models: [] };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });

  it("rejects an unexpected schemaVersion", () => {
    const candidate = { ...validSnapshot, schemaVersion: 2 };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });
});
