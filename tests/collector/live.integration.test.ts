import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { collectQuotaSnapshot } from "../../src/collector/index";
import { snapshotSchema } from "../../src/schema/snapshot";

const liveEnabled = process.env.LIVE_SOURCE === "1";

describe.skipIf(!liveEnabled)("live source integration", () => {
  it("fetches the real page and produces a valid snapshot", async () => {
    const dir = await mkdtemp(join(tmpdir(), "opencode-sentry-live-"));

    try {
      const path = await collectQuotaSnapshot({ outputDir: dir });
      const raw = JSON.parse(await readFile(path, "utf8"));
      const snapshot = snapshotSchema.parse(raw);

      expect(snapshot.models.length).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
});
