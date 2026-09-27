import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectQuotaSnapshot } from "../../src/collector/index";
import type { FetchLike } from "../../src/collector/fetch";
import { snapshotSchema } from "../../src/schema/snapshot";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.html`), "utf8");
}

function serve(html: string): FetchLike {
  return async () => new Response(html, { status: 200 });
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
});
