import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectQuotaSnapshot } from "../../src/collector/index";
import type { FetchLike } from "../../src/collector/fetch";
import { CATALOG_URL } from "../../src/metadata/index";
import { snapshotSchema } from "../../src/schema/snapshot";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.html`), "utf8");
}

function catalogFixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.json`), "utf8");
}

function serve(html: string, catalog = catalogFixture("models-dev.catalog")): FetchLike {
  return async (url) => {
    if (url === CATALOG_URL) {
      return new Response(catalog, { status: 200 });
    }
    return new Response(html, { status: 200 });
  };
}

const now = () => new Date("2026-09-27T12:15:30.000Z");

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opencode-sentry-e2e-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("collectQuotaSnapshot", () => {
  it("writes a schema-valid snapshot through the full pipeline", async () => {
    const path = await collectQuotaSnapshot({
      fetchImpl: serve(fixture("opencode-go.valid")),
      now,
      outputDir: dir,
    });

    const raw = JSON.parse(await readFile(path, "utf8"));
    const snapshot = snapshotSchema.parse(raw);

    expect(snapshot.models).toHaveLength(4);
    expect(snapshot.source.url).toBe("https://opencode.ai/v2/docs/console/go");
    expect(snapshot.scrapedAt).toBe("2026-09-27T12:15:30.000Z");

    const plans = new Set(
      snapshot.models.flatMap((model) => (model.pricing ?? []).map((p) => p.plan)),
    );
    expect(plans).toEqual(new Set(["go", "go-plus"]));
    expect(snapshot.models[0]?.pricing).toHaveLength(2);

    const kimi = snapshot.models.find((model) => model.id === "opencode/kimi-k2.5");
    expect(kimi?.metadata?.contextLimit).toBe(256000);
    expect(snapshot.models.every((model) => model.metadata !== undefined)).toBe(true);
  });

  it("writes no file when parsing fails", async () => {
    await expect(
      collectQuotaSnapshot({
        fetchImpl: serve(fixture("opencode-go.estimated-missing-section")),
        now,
        outputDir: dir,
      }),
    ).rejects.toThrow();

    expect(await readdir(dir)).toEqual([]);
  });

  it("writes no file when matching fails", async () => {
    await expect(
      collectQuotaSnapshot({
        fetchImpl: serve(fixture("opencode-go.unmatched-model")),
        now,
        outputDir: dir,
      }),
    ).rejects.toThrow(/has no Endpoints entry/);

    expect(await readdir(dir)).toEqual([]);
  });

  it("writes no file when the request fails", async () => {
    const failing: FetchLike = async () => new Response("server error", { status: 500 });

    await expect(
      collectQuotaSnapshot({ fetchImpl: failing, now, outputDir: dir }),
    ).rejects.toThrow();

    expect(await readdir(dir)).toEqual([]);
  });

  it("writes no file when the catalog request fails", async () => {
    const failingCatalog: FetchLike = async (url) =>
      url === CATALOG_URL
        ? new Response("server error", { status: 500 })
        : new Response(fixture("opencode-go.valid"), { status: 200 });

    await expect(
      collectQuotaSnapshot({ fetchImpl: failingCatalog, now, outputDir: dir }),
    ).rejects.toThrow(/models\.dev catalog/);

    expect(await readdir(dir)).toEqual([]);
  });

  it("writes no file when selected metadata is invalid", async () => {
    await expect(
      collectQuotaSnapshot({
        fetchImpl: serve(fixture("opencode-go.valid"), catalogFixture("models-dev.invalid")),
        now,
        outputDir: dir,
      }),
    ).rejects.toThrow();

    expect(await readdir(dir)).toEqual([]);
  });

  it("succeeds when a model has no catalog entry", async () => {
    const path = await collectQuotaSnapshot({
      fetchImpl: serve(fixture("opencode-go.valid"), catalogFixture("models-dev.partial")),
      now,
      outputDir: dir,
    });

    const snapshot = snapshotSchema.parse(JSON.parse(await readFile(path, "utf8")));
    const withMetadata = snapshot.models.filter((model) => model.metadata !== undefined);

    expect(withMetadata.map((model) => model.id)).toEqual(["opencode/kimi-k2.5"]);
  });
});
