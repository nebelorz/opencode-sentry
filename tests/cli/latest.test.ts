import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runLatest, type LatestIo } from "../../src/cli/latest.ts";
import validChangeReport from "../fixtures/latest/change-report.valid.json";
import validSnapshot from "../fixtures/latest/snapshot.valid.json";

function recordingIo() {
  const logs: string[] = [];
  const errors: string[] = [];
  const io: LatestIo = {
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
  };
  return { io, logs, errors };
}

let root: string;
let snapshotsDir: string;
let changesDir: string;
let latestPath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "opencode-sentry-latest-"));
  snapshotsDir = join(root, "snapshots");
  changesDir = join(root, "changes");
  latestPath = join(root, "latest.json");
  await mkdir(snapshotsDir, { recursive: true });
  await mkdir(changesDir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function options() {
  return { snapshotsDir, changesDir, latestPath };
}

async function writeJson(dir: string, name: string, value: unknown): Promise<void> {
  await writeFile(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("runLatest", () => {
  it("selects the newest files and writes the pointer", async () => {
    await writeJson(snapshotsDir, "2026-09-27T10-00.json", validSnapshot);
    await writeJson(snapshotsDir, "2026-09-27T12-00.json", validSnapshot);
    await writeJson(changesDir, "2026-09-27T11-00.json", validChangeReport);
    await writeJson(changesDir, "2026-09-27T13-00.json", validChangeReport);
    const { io } = recordingIo();

    const code = await runLatest(options(), io);

    expect(code).toBe(0);
    expect(JSON.parse(await readFile(latestPath, "utf8"))).toEqual({
      snapshot: "snapshots/2026-09-27T12-00.json",
      changes: "changes/2026-09-27T13-00.json",
    });
  });

  it("returns non-zero when a directory has no data files", async () => {
    const { io, errors } = recordingIo();

    const code = await runLatest(options(), io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/No snapshot files found/);
  });

  it("returns non-zero when a directory is missing", async () => {
    const { io, errors } = recordingIo();

    const code = await runLatest({ ...options(), snapshotsDir: join(root, "missing") }, io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/Unable to read snapshot directory/);
  });

  it("returns non-zero when the newest file is malformed JSON", async () => {
    await writeFile(join(snapshotsDir, "2026-09-27T10-00.json"), "{ not json", "utf8");
    await writeJson(changesDir, "2026-09-27T11-00.json", validChangeReport);
    const { io, errors } = recordingIo();

    const code = await runLatest(options(), io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/Unable to parse snapshot file/);
  });

  it("returns non-zero when the newest file fails schema validation", async () => {
    await writeJson(snapshotsDir, "2026-09-27T10-00.json", { schemaVersion: 999 });
    await writeJson(changesDir, "2026-09-27T11-00.json", validChangeReport);
    const { io, errors } = recordingIo();

    const code = await runLatest(options(), io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/Invalid snapshot file/);
  });

  it("does not write a pointer when validation fails", async () => {
    await writeJson(snapshotsDir, "2026-09-27T10-00.json", { schemaVersion: 999 });
    await writeJson(changesDir, "2026-09-27T11-00.json", validChangeReport);
    const { io } = recordingIo();

    await runLatest(options(), io);

    await expect(readFile(latestPath, "utf8")).rejects.toThrow();
  });
});
