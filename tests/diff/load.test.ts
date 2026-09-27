import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadSnapshots, selectLatestTwo } from "../../src/diff/load";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "snapshots");

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opencode-sentry-load-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function copyFixture(name: string, target = name): Promise<void> {
  await copyFile(join(fixturesDir, name), join(dir, target));
}

describe("loadSnapshots", () => {
  it("loads every snapshot JSON file", async () => {
    await copyFixture("2026-09-27T10-00.json");
    await copyFixture("2026-09-27T11-00.json");

    const loaded = await loadSnapshots(dir);

    expect(loaded.map((entry) => entry.filename)).toEqual([
      "2026-09-27T10-00.json",
      "2026-09-27T11-00.json",
    ]);
    expect(loaded[0]?.snapshot.scrapedAt).toBe("2026-09-27T10:00:00.000Z");
  });

  it("rejects an invalid snapshot and names the file", async () => {
    await copyFixture("2026-09-27T10-00.json");
    await copyFixture("invalid.json");

    await expect(loadSnapshots(dir)).rejects.toThrow(/invalid\.json/);
  });
});

describe("selectLatestTwo", () => {
  it("throws when fewer than two snapshots exist", () => {
    expect(() => selectLatestTwo([])).toThrow(/at least two snapshots are required/);
  });

  it("throws when only one snapshot exists", async () => {
    await copyFixture("2026-09-27T10-00.json");
    const loaded = await loadSnapshots(dir);

    expect(loaded).toHaveLength(1);
    expect(() => selectLatestTwo(loaded)).toThrow(/at least two snapshots are required/);
  });

  it("selects the earlier snapshot as baseline for exactly two snapshots", async () => {
    await copyFixture("2026-09-27T11-00.json");
    await copyFixture("2026-09-27T10-00.json");
    const loaded = await loadSnapshots(dir);

    const [previous, latest] = selectLatestTwo(loaded);

    expect([previous.scrapedAt, latest.scrapedAt]).toEqual([
      "2026-09-27T10:00:00.000Z",
      "2026-09-27T11:00:00.000Z",
    ]);
  });

  it("selects only the latest two of more than two snapshots", async () => {
    await copyFixture("2026-09-27T12-00.json");
    await copyFixture("2026-09-27T10-00.json");
    await copyFixture("2026-09-27T11-00.json");
    const loaded = await loadSnapshots(dir);

    const [previous, latest] = selectLatestTwo(loaded);

    expect([previous.scrapedAt, latest.scrapedAt]).toEqual([
      "2026-09-27T11:00:00.000Z",
      "2026-09-27T12:00:00.000Z",
    ]);
  });
});
