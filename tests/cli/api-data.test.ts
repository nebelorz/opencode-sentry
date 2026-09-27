import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runApiData, type ApiDataIo } from "../../src/cli/api-data.ts";
import invalidChangeReport from "../fixtures/api/change-report.invalid.json";
import validChangeReport from "../fixtures/api/change-report.valid.json";
import invalidSnapshot from "../fixtures/api/snapshot.invalid.json";
import validSnapshot from "../fixtures/api/snapshot.valid.json";

function recordingIo() {
  const logs: string[] = [];
  const errors: string[] = [];
  const io: ApiDataIo = {
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
  };
  return { io, logs, errors };
}

let root: string;
let snapshotsDir: string;
let changesDir: string;
let latestPath: string;
let dataModulePath: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "opencode-sentry-api-data-"));
  snapshotsDir = join(root, "snapshots");
  changesDir = join(root, "changes");
  latestPath = join(root, "latest.json");
  dataModulePath = join(root, "data.ts");
  await mkdir(snapshotsDir, { recursive: true });
  await mkdir(changesDir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function options() {
  return { snapshotsDir, changesDir, latestPath, dataModulePath };
}

async function writeJson(dir: string, name: string, value: unknown): Promise<void> {
  await writeFile(join(dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("runApiData", () => {
  it("selects the newest files and writes the pointer and index module", async () => {
    await writeJson(snapshotsDir, "2026-09-27T10-00.json", validSnapshot);
    await writeJson(snapshotsDir, "2026-09-27T12-00.json", validSnapshot);
    await writeJson(changesDir, "2026-09-27T11-00.json", validChangeReport);
    await writeJson(changesDir, "2026-09-27T13-00.json", validChangeReport);
    const { io } = recordingIo();

    const code = await runApiData(options(), io);

    expect(code).toBe(0);
    expect(JSON.parse(await readFile(latestPath, "utf8"))).toEqual({
      snapshot: "snapshots/2026-09-27T12-00.json",
      changes: "changes/2026-09-27T13-00.json",
    });

    const module = await readFile(dataModulePath, "utf8");
    expect(module).toContain('"./snapshots/2026-09-27T12-00.json"');
    expect(module).toContain('"./changes/2026-09-27T13-00.json"');
    expect(module).toContain("export const latestSnapshot: unknown = snapshot;");
    expect(module).toContain("export const latestChangeReport: unknown = changes;");
  });

  it("returns non-zero when a directory has no data files", async () => {
    const { io, errors } = recordingIo();

    const code = await runApiData(options(), io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/No snapshot files found/);
  });

  it("returns non-zero when a directory is missing", async () => {
    const { io, errors } = recordingIo();

    const code = await runApiData({ ...options(), snapshotsDir: join(root, "missing") }, io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/Unable to read snapshot directory/);
  });

  it("returns non-zero when the newest file is malformed JSON", async () => {
    await writeFile(join(snapshotsDir, "2026-09-27T10-00.json"), "{ not json", "utf8");
    await writeJson(changesDir, "2026-09-27T11-00.json", validChangeReport);
    const { io, errors } = recordingIo();

    const code = await runApiData(options(), io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/Unable to parse snapshot file/);
  });

  it("returns non-zero when the newest file fails schema validation", async () => {
    await writeJson(snapshotsDir, "2026-09-27T10-00.json", invalidSnapshot);
    await writeJson(changesDir, "2026-09-27T11-00.json", invalidChangeReport);
    const { io, errors } = recordingIo();

    const code = await runApiData(options(), io);

    expect(code).toBe(1);
    expect(errors[0]).toMatch(/Invalid snapshot file/);
  });
});
