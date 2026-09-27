import { copyFile, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runDiffPipeline } from "../../src/diff/index";
import { changeReportSchema } from "../../src/schema/change";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "snapshots");

let root: string;
let snapshotsDir: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "opencode-sentry-diff-"));
  snapshotsDir = join(root, "snapshots");
  await mkdir(snapshotsDir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function copyFixture(name: string, target = name): Promise<void> {
  await copyFile(join(fixturesDir, name), join(snapshotsDir, target));
}

describe("runDiffPipeline", () => {
  it("writes a validated report derived from the latest snapshot", async () => {
    await copyFixture("2026-09-27T10-00.json");
    await copyFixture("2026-09-27T11-00.json");
    await copyFixture("2026-09-27T12-00.json");

    const changesDir = join(root, "changes");
    const path = await runDiffPipeline({ snapshotsDir, changesDir });

    expect(path).toBe(join(changesDir, "2026-09-27T12-00.json"));

    const report = changeReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
    expect(report.from).toBe("2026-09-27T11:00:00.000Z");
    expect(report.to).toBe("2026-09-27T12:00:00.000Z");
    expect(report.changes).toEqual([
      {
        type: "quota_changed",
        model: { id: "opencode/kimi-k2.5", name: "Kimi K2.5" },
        quota: {
          period: "weekly",
          previous: 12000,
          current: 10000,
          change: -2000,
          changePercent: -16.67,
        },
      },
    ]);
  });

  it("produces deterministic ordering across repeated runs", async () => {
    await copyFixture("2026-09-27T10-00.json");
    await copyFixture("2026-09-27T11-00.json");
    await copyFixture("2026-09-27T12-00.json");

    const first = await runDiffPipeline({ snapshotsDir, changesDir: join(root, "first") });
    const second = await runDiffPipeline({ snapshotsDir, changesDir: join(root, "second") });

    expect(await readFile(second, "utf8")).toBe(await readFile(first, "utf8"));
  });

  it("persists an empty report when the two latest snapshots are equivalent", async () => {
    await copyFixture("2026-09-27T10-00.json", "a.json");
    await copyFixture("2026-09-27T10-00.json", "b.json");

    const changesDir = join(root, "changes");
    const path = await runDiffPipeline({ snapshotsDir, changesDir });

    const report = JSON.parse(await readFile(path, "utf8"));
    expect(report.changes).toEqual([]);
  });

  it("leaves no report behind when a stage fails", async () => {
    await copyFixture("2026-09-27T10-00.json");

    const changesDir = join(root, "changes");
    await expect(runDiffPipeline({ snapshotsDir, changesDir })).rejects.toThrow(
      /at least two snapshots are required/,
    );

    await expect(readdir(changesDir)).rejects.toThrow();
  });
});
