import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { persistChangeReport, reportFilename } from "../../src/diff/persist";
import type { ChangeReport } from "../../src/schema/change";

function report(changes: ChangeReport["changes"] = []): ChangeReport {
  return {
    schemaVersion: 1,
    from: "2026-09-27T11:00:00.000Z",
    to: "2026-09-27T12:15:30.000Z",
    changes,
  };
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opencode-sentry-persist-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("reportFilename", () => {
  it("derives a minute-precision UTC filename", () => {
    expect(reportFilename("2026-09-27T12:15:30.000Z")).toBe("2026-09-27T12-15.json");
  });
});

describe("persistChangeReport", () => {
  it("writes a new report at the derived path", async () => {
    const path = await persistChangeReport(report(), dir);

    expect(path).toBe(join(dir, "2026-09-27T12-15.json"));
    expect(await readdir(dir)).toEqual(["2026-09-27T12-15.json"]);
  });

  it("persists an empty change report successfully", async () => {
    const path = await persistChangeReport(report([]), dir);

    const contents = JSON.parse(await readFile(path, "utf8"));
    expect(contents.changes).toEqual([]);
  });

  it("fails with EEXIST without altering an existing report", async () => {
    const path = join(dir, "2026-09-27T12-15.json");
    await persistChangeReport(report(), dir);

    const original = await readFile(path, "utf8");

    await expect(persistChangeReport(report(), dir)).rejects.toThrow(/EEXIST/);
    expect(await readFile(path, "utf8")).toBe(original);
  });

  it("leaves no partial report after a rejected write", async () => {
    await persistChangeReport(report(), dir);

    await expect(persistChangeReport(report(), dir)).rejects.toThrow();

    const files = await readdir(dir);
    expect(files).toEqual(["2026-09-27T12-15.json"]);
  });
});
