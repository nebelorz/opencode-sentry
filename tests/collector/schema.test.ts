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

  it("accepts optional pricing entries including null and unlimited", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          ...validSnapshot.models[0],
          pricing: [
            {
              plan: "go",
              variant: "off-peak",
              variantLabel: "Off-Peak",
              input: 0.15,
              output: 0.6,
              cachedRead: 0.003,
              cachedWrite: null,
              monthlyLimit: { amount: 60, currency: "USD" },
            },
            {
              plan: "go-plus",
              variant: "default",
              variantLabel: "Default",
              input: 0,
              output: 0,
              cachedRead: 0,
              cachedWrite: null,
              monthlyLimit: "unlimited",
            },
          ],
        },
      ],
    };

    const parsed = snapshotSchema.parse(candidate);

    expect(parsed.models[0]?.pricing).toHaveLength(2);
  });

  it("rejects an unknown pricing plan", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          ...validSnapshot.models[0],
          pricing: [
            {
              plan: "pro",
              variant: "default",
              variantLabel: "Default",
              input: 1,
              output: 1,
              cachedRead: null,
              cachedWrite: null,
              monthlyLimit: { amount: 1, currency: "USD" },
            },
          ],
        },
      ],
    };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });

  it("rejects a pricing entry missing a required price", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          ...validSnapshot.models[0],
          pricing: [
            {
              plan: "go",
              variant: "default",
              variantLabel: "Default",
              output: 1,
              cachedRead: null,
              cachedWrite: null,
              monthlyLimit: { amount: 1, currency: "USD" },
            },
          ],
        },
      ],
    };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });

  it("accepts optional model metadata with the selected fields", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          ...validSnapshot.models[0],
          metadata: {
            contextLimit: 256000,
            outputLimit: 64000,
            modalities: { input: ["text", "image"], output: ["text"] },
            capabilities: {
              attachment: true,
              reasoning: true,
              toolCall: true,
              structuredOutput: true,
              temperature: true,
              openWeights: false,
            },
            family: "kimi",
            knowledgeCutoff: "2025-04",
            releaseDate: "2025-06-01",
            canonicalModelId: "moonshotai/kimi-k2.5",
          },
        },
      ],
    };

    const parsed = snapshotSchema.parse(candidate);

    expect(parsed.models[0]?.metadata?.contextLimit).toBe(256000);
    expect(parsed.models[0]?.metadata?.capabilities?.openWeights).toBe(false);
  });

  it("accepts metadata with only the required limits", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          ...validSnapshot.models[0],
          metadata: { contextLimit: 1000, outputLimit: 500 },
        },
      ],
    };

    const parsed = snapshotSchema.parse(candidate);

    expect(parsed.models[0]?.metadata).toEqual({ contextLimit: 1000, outputLimit: 500 });
  });

  it("rejects metadata with a negative limit", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          ...validSnapshot.models[0],
          metadata: { contextLimit: -1, outputLimit: 500 },
        },
      ],
    };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });

  it("rejects metadata with a decimal limit", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          ...validSnapshot.models[0],
          metadata: { contextLimit: 1000.5, outputLimit: 500 },
        },
      ],
    };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });

  it("rejects metadata missing the output limit", () => {
    const candidate = {
      ...validSnapshot,
      models: [
        {
          ...validSnapshot.models[0],
          metadata: { contextLimit: 1000 },
        },
      ],
    };

    expect(() => snapshotSchema.parse(candidate)).toThrow();
  });
});
