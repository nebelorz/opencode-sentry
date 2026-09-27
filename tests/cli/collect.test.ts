import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runCollect, type CollectIo } from "../../src/cli/collect.ts";
import type { FetchLike } from "../../src/collector/fetch.ts";
import { collectQuotaSnapshot } from "../../src/collector/index.ts";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.html`), "utf8");
}

function serve(html: string): FetchLike {
  return async () => new Response(html, { status: 200 });
}

function recordingIo() {
  const logs: string[] = [];
  const errors: string[] = [];
  const io: CollectIo = {
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
  };
  return { io, logs, errors };
}

const now = () => new Date("2026-09-27T12:15:30.000Z");
const plainFailure: unknown = "plain failure";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "opencode-sentry-cli-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runCollect", () => {
  it("returns 0 and reports the snapshot path on success", async () => {
    const { io, logs, errors } = recordingIo();
    const path = join(dir, "snapshot.json");

    const code = await runCollect(async () => path, io);

    expect(code).toBe(0);
    expect(logs).toEqual([`Snapshot created: ${path}`]);
    expect(errors).toEqual([]);
  });

  it("returns non-zero and surfaces an Error message on the error stream", async () => {
    const { io, logs, errors } = recordingIo();

    const code = await runCollect(async () => {
      throw new Error("collector exploded");
    }, io);

    expect(code).toBe(1);
    expect(errors).toEqual(["collector exploded"]);
    expect(logs).toEqual([]);
  });

  it("surfaces a thrown non-Error value", async () => {
    const { io, errors } = recordingIo();

    const code = await runCollect(async () => {
      throw plainFailure;
    }, io);

    expect(code).toBe(1);
    expect(errors).toEqual(["plain failure"]);
  });

  it("does not overwrite an existing snapshot and surfaces EEXIST", async () => {
    const { io, logs, errors } = recordingIo();
    const collect = () =>
      collectQuotaSnapshot({
        fetchImpl: serve(fixture("opencode-go.valid")),
        now,
        outputDir: dir,
      });

    const first = await runCollect(collect, io);
    const path = join(dir, "2026-09-27T12-15.json");
    const contents = await readFile(path, "utf8");

    const second = await runCollect(collect, io);

    expect(first).toBe(0);
    expect(logs).toEqual([`Snapshot created: ${path}`]);
    expect(second).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/EEXIST/);
    expect(await readdir(dir)).toEqual(["2026-09-27T12-15.json"]);
    expect(await readFile(path, "utf8")).toBe(contents);
  });
});
