import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runDiff, type DiffIo } from "../../src/cli/diff.ts";

function recordingIo() {
  const logs: string[] = [];
  const errors: string[] = [];
  const io: DiffIo = {
    log: (message) => logs.push(message),
    error: (message) => errors.push(message),
  };
  return { io, logs, errors };
}

const plainFailure: unknown = "plain failure";

describe("runDiff", () => {
  it("returns 0 and reports the report path on success", async () => {
    const { io, logs, errors } = recordingIo();
    const path = join("data", "changes", "2026-09-27T12-15.json");

    const code = await runDiff(async () => path, io);

    expect(code).toBe(0);
    expect(logs).toEqual([`Change report created: ${path}`]);
    expect(errors).toEqual([]);
  });

  it("returns non-zero and surfaces an Error message on the error stream", async () => {
    const { io, logs, errors } = recordingIo();

    const code = await runDiff(async () => {
      throw new Error("diff exploded");
    }, io);

    expect(code).toBe(1);
    expect(errors).toEqual(["diff exploded"]);
    expect(logs).toEqual([]);
  });

  it("surfaces a thrown non-Error value", async () => {
    const { io, errors } = recordingIo();

    const code = await runDiff(async () => {
      throw plainFailure;
    }, io);

    expect(code).toBe(1);
    expect(errors).toEqual(["plain failure"]);
  });
});
