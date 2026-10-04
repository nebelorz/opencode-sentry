import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { matchModels } from "../../src/collector/match";
import {
  parseEndpoints,
  parseEstimatedRequests,
  parsePricing,
  type EstimatedRequestsTable,
  type PricingRow,
} from "../../src/collector/parse";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.html`), "utf8");
}

function matchFixture(name: string) {
  return matchModels(
    parseEstimatedRequests(fixture(name)),
    parseEndpoints(fixture(name)),
    parsePricing(fixture(name)),
  );
}

const singleModelEstimated: EstimatedRequestsTable = {
  modelIndex: 0,
  fiveHourIndex: 1,
  weeklyIndex: 2,
  monthlyIndex: 3,
  rows: [["Kimi K2.5", "1,500", "12,000", "40,000"]],
};

const kimiEndpoint = [{ name: "Kimi K2.5", id: "opencode/kimi-k2.5" }];

function kimiPricing(overrides: Partial<PricingRow> = {}): PricingRow {
  return {
    plan: "go",
    baseName: "Kimi K2.5",
    variant: "default",
    variantLabel: "Default",
    input: "$0.95",
    output: "$4.00",
    cachedRead: "$0.16",
    cachedWrite: "-",
    monthlyLimit: "$60",
    ...overrides,
  };
}

describe("matchModels", () => {
  it("takes ids from Endpoints and quotas from Estimated requests", () => {
    const models = matchFixture("opencode-go.valid");

    expect(models).toHaveLength(4);
    expect(models[0]).toMatchObject({
      id: "opencode/kimi-k2.5",
      name: "Kimi K2.5",
      estimatedRequests: {
        fiveHour: 1500,
        weekly: 12000,
        monthly: 40000,
      },
    });
  });

  it("attaches normalized pricing for both plans", () => {
    const models = matchFixture("opencode-go.valid");
    const kimi = models.find((model) => model.name === "Kimi K2.5");

    expect(kimi?.pricing).toEqual([
      {
        plan: "go",
        variant: "default",
        variantLabel: "Default",
        input: 0.95,
        output: 4,
        cachedRead: 0.16,
        cachedWrite: null,
        monthlyLimit: { amount: 60, currency: "USD" },
      },
      {
        plan: "go-plus",
        variant: "default",
        variantLabel: "Default",
        input: 0.95,
        output: 4,
        cachedRead: 0.16,
        cachedWrite: null,
        monthlyLimit: { amount: 180, currency: "USD" },
      },
    ]);
  });

  it("uses the Endpoints Model ID verbatim, not a name-derived slug", () => {
    const models = matchFixture("opencode-go.valid");
    const kimi = models.find((model) => model.name === "Kimi K2.5");

    expect(kimi?.id).toBe("opencode/kimi-k2.5");
    expect(kimi?.id).not.toBe("kimi-k2-5");
  });

  it("matches qualifier-labeled pricing rows to their base model", () => {
    const models = matchFixture("opencode-go.pricing-variants");
    const qwen = models.find((model) => model.name === "Qwen3.7 Plus");

    expect(qwen?.pricing?.map((entry) => entry.variant)).toEqual([
      "le-256k",
      "gt-256k",
      "le-256k",
      "gt-256k",
    ]);
  });

  it("allows multiple variants for one model and plan", () => {
    const models = matchFixture("opencode-go.pricing-variants");
    const deepseek = models.find((model) => model.name === "DeepSeek V4.1 Flash");

    expect(deepseek?.pricing?.map((entry) => `${entry.plan}:${entry.variant}`)).toEqual([
      "go:off-peak",
      "go:peak",
      "go-plus:off-peak",
      "go-plus:peak",
    ]);
  });

  it("throws when a pricing model matches no snapshot model", () => {
    const pricing = [kimiPricing({ baseName: "Ghost Model" })];

    expect(() => matchModels(singleModelEstimated, kimiEndpoint, pricing)).toThrow(
      /has no snapshot model/,
    );
  });

  it("throws when a model has no pricing for a plan", () => {
    const pricing = [kimiPricing({ plan: "go" })];

    expect(() => matchModels(singleModelEstimated, kimiEndpoint, pricing)).toThrow(
      /has no go-plus pricing/,
    );
  });

  it("throws when an Estimated requests model has no Endpoints entry", () => {
    expect(() => matchFixture("opencode-go.unmatched-model")).toThrow(/has no Endpoints entry/);
  });

  it("ignores Endpoints entries that no quota row references", () => {
    const models = matchFixture("opencode-go.extra-endpoints-model");

    expect(models).toHaveLength(1);
    expect(models[0]?.name).toBe("Kimi K2.5");
  });

  it("throws when an Estimated row matches more than one Endpoints entry", () => {
    const estimated: EstimatedRequestsTable = {
      modelIndex: 0,
      fiveHourIndex: 1,
      weeklyIndex: 2,
      monthlyIndex: 3,
      rows: [["Kimi K2.5", "1", "2", "3"]],
    };
    const endpoints = [
      { name: "Kimi K2.5", id: "opencode/kimi-k2.5" },
      { name: "Kimi K2.5", id: "opencode/kimi-k2.5-turbo" },
    ];

    expect(() => matchModels(estimated, endpoints, [])).toThrow(/Duplicate model name/);
  });

  it("throws when two Estimated rows match the same Endpoints entry", () => {
    const estimated: EstimatedRequestsTable = {
      modelIndex: 0,
      fiveHourIndex: 1,
      weeklyIndex: 2,
      monthlyIndex: 3,
      rows: [
        ["Kimi K2.5", "1", "2", "3"],
        ["Kimi K2.5", "4", "5", "6"],
      ],
    };
    const endpoints = [{ name: "Kimi K2.5", id: "opencode/kimi-k2.5" }];

    expect(() => matchModels(estimated, endpoints, [])).toThrow(
      /more than one Estimated requests row/,
    );
  });
});
