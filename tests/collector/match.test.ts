import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { matchModels } from "../../src/collector/match";
import {
  parseEndpoints,
  parseEstimatedRequests,
  type EstimatedRequestsTable,
} from "../../src/collector/parse";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.html`), "utf8");
}

function matchFixture(name: string) {
  return matchModels(parseEstimatedRequests(fixture(name)), parseEndpoints(fixture(name)));
}

describe("matchModels", () => {
  it("takes ids from Endpoints and quotas from Estimated requests", () => {
    const models = matchFixture("opencode-go.valid");

    expect(models).toHaveLength(4);
    expect(models[0]).toEqual({
      id: "opencode/kimi-k2.5",
      name: "Kimi K2.5",
      estimatedRequests: {
        fiveHour: 1500,
        weekly: 12000,
        monthly: 40000,
      },
    });
  });

  it("uses the Endpoints Model ID verbatim, not a name-derived slug", () => {
    const models = matchFixture("opencode-go.valid");
    const kimi = models.find((model) => model.name === "Kimi K2.5");

    expect(kimi?.id).toBe("opencode/kimi-k2.5");
    expect(kimi?.id).not.toBe("kimi-k2-5");
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

    expect(() => matchModels(estimated, endpoints)).toThrow(/Duplicate model name/);
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

    expect(() => matchModels(estimated, endpoints)).toThrow(/more than one Estimated requests row/);
  });
});
