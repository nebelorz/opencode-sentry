import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { persistSnapshot, snapshotFilename } from "../../src/collector/persist";
import { buildSnapshot } from "../../src/collector/snapshot";
import type { SnapshotModel } from "../../src/schema/snapshot";

const scrapedAt = new Date("2026-09-27T12:15:30.000Z");

function model(monthly: number | "unlimited"): SnapshotModel {
  return {
    id: "opencode/kimi-k2.5",
    name: "Kimi K2.5",
    estimatedRequests: { fiveHour: 1500, weekly: 12000, monthly },
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opencode-sentry-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("snapshotFilename", () => {
  it("derives a minute-precision UTC filename", () => {
    expect(snapshotFilename("2026-09-27T12:15:30.000Z")).toBe("2026-09-27T12-15.json");
  });
});

describe("persistSnapshot", () => {
  it("writes a new file at the derived path", async () => {
    const path = await persistSnapshot(buildSnapshot([model(40000)], scrapedAt), dir);

    expect(path).toBe(join(dir, "2026-09-27T12-15.json"));
    expect((await readdir(dir)).sort()).toEqual(["2026-09-27T12-15.json"]);

    const contents = JSON.parse(await readFile(path, "utf8"));
    expect(contents.models[0].id).toBe("opencode/kimi-k2.5");
  });

  it("fails with EEXIST without altering an existing file", async () => {
    const path = join(dir, "2026-09-27T12-15.json");
    await persistSnapshot(buildSnapshot([model(40000)], scrapedAt), dir);

    await expect(persistSnapshot(buildSnapshot([model(999)], scrapedAt), dir)).rejects.toThrow(
      /EEXIST/,
    );

    const contents = JSON.parse(await readFile(path, "utf8"));
    expect(contents.models[0].estimatedRequests.monthly).toBe(40000);
  });

  it("leaves no partial file after a rejected write", async () => {
    await persistSnapshot(buildSnapshot([model(40000)], scrapedAt), dir);

    await expect(persistSnapshot(buildSnapshot([model(999)], scrapedAt), dir)).rejects.toThrow();

    const files = await readdir(dir);
    expect(files).toEqual(["2026-09-27T12-15.json"]);

    const contents = JSON.parse(await readFile(join(dir, files[0]), "utf8"));
    expect(contents.models[0].estimatedRequests.monthly).toBe(40000);
  });
});
