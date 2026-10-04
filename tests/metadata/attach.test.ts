import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { FetchLike } from "../../src/collector/fetch";
import type { SnapshotModel } from "../../src/schema/snapshot";
import { CATALOG_URL, type CatalogModels } from "../../src/metadata/catalog";
import { attachMetadata, enrichModels } from "../../src/metadata/enrich";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixtureCatalog(): CatalogModels {
  const catalog = JSON.parse(
    readFileSync(join(fixturesDir, "models-dev.catalog.json"), "utf8"),
  ) as { "opencode-go": { models: CatalogModels } };
  return catalog["opencode-go"].models;
}

function model(id: string): SnapshotModel {
  return {
    id,
    name: id,
    estimatedRequests: { fiveHour: 1, weekly: 2, monthly: 3 },
  };
}

describe("attachMetadata", () => {
  it("attaches metadata when the model id matches a catalog entry", () => {
    const models = attachMetadata([model("opencode/kimi-k2.5")], fixtureCatalog());

    expect(models[0]?.metadata?.contextLimit).toBe(256000);
    expect(models[0]?.metadata?.canonicalModelId).toBe("moonshotai/kimi-k2.5");
  });

  it("omits metadata when there is no catalog entry", () => {
    const models = attachMetadata([model("unknown-model")], fixtureCatalog());

    expect(models[0]).not.toHaveProperty("metadata");
  });

  it("matches only some models when the catalog covers a subset", () => {
    const models = attachMetadata(
      [model("opencode/kimi-k2.5"), model("unknown-model")],
      fixtureCatalog(),
    );

    expect(models[0]).toHaveProperty("metadata");
    expect(models[1]).not.toHaveProperty("metadata");
  });

  it("does not attach metadata based on a similar name or id", () => {
    const catalog: CatalogModels = {
      "kimi-k2.5-turbo": { id: "kimi-k2.5-turbo", limit: { context: 1, output: 1 } },
      "Kimi-K2.5": { id: "Kimi-K2.5", limit: { context: 1, output: 1 } },
    };

    const models = attachMetadata([model("kimi-k2.5")], catalog);

    expect(models[0]).not.toHaveProperty("metadata");
  });
});

describe("enrichModels", () => {
  it("fetches the catalog and attaches metadata to matched models", async () => {
    const body = readFileSync(join(fixturesDir, "models-dev.catalog.json"), "utf8");
    const fetchImpl: FetchLike = async (url) => {
      expect(url).toBe(CATALOG_URL);
      return new Response(body, { status: 200 });
    };

    const models = await enrichModels([model("opencode/glm-4.6")], fetchImpl);

    expect(models[0]?.metadata?.contextLimit).toBe(200000);
  });
});
