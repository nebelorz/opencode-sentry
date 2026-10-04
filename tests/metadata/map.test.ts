import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { toModelMetadata } from "../../src/metadata/map";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function catalogEntry(id: string): Record<string, unknown> {
  const catalog = JSON.parse(
    readFileSync(join(fixturesDir, "models-dev.catalog.json"), "utf8"),
  ) as { "opencode-go": { models: Record<string, Record<string, unknown>> } };
  return catalog["opencode-go"].models[id]!;
}

describe("toModelMetadata", () => {
  it("maps the selected fields from a catalog entry", () => {
    const metadata = toModelMetadata(catalogEntry("opencode/kimi-k2.5"));

    expect(metadata).toEqual({
      contextLimit: 256000,
      outputLimit: 64000,
      modalities: { input: ["text", "image"], output: ["text"] },
      capabilities: {
        attachment: true,
        reasoning: true,
        toolCall: true,
        structuredOutput: true,
        temperature: true,
        openWeights: false,
      },
      family: "kimi",
      knowledgeCutoff: "2025-04",
      releaseDate: "2025-06-01",
      canonicalModelId: "moonshotai/kimi-k2.5",
    });
  });

  it("stores only the required limits when optional fields are absent", () => {
    const metadata = toModelMetadata({ id: "x", limit: { context: 1000, output: 500 } });

    expect(metadata).toEqual({ contextLimit: 1000, outputLimit: 500 });
  });

  it("excludes provider, endpoint, environment, package, and description fields", () => {
    const metadata = toModelMetadata(catalogEntry("opencode/kimi-k2.5"));

    expect(Object.keys(metadata).sort()).toEqual([
      "canonicalModelId",
      "capabilities",
      "contextLimit",
      "family",
      "knowledgeCutoff",
      "modalities",
      "outputLimit",
      "releaseDate",
    ]);

    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toMatch(/description|api|env|npm|cost|last_updated|interleaved/i);
  });

  it("rejects an entry with a negative limit", () => {
    expect(() => toModelMetadata({ limit: { context: -1, output: 500 } })).toThrow();
  });

  it("rejects an entry with a non-numeric limit", () => {
    expect(() => toModelMetadata({ limit: { context: "many", output: 500 } })).toThrow();
  });

  it("rejects an entry missing the output limit", () => {
    expect(() => toModelMetadata({ limit: { context: 1000 } })).toThrow();
  });

  it("rejects a non-object entry", () => {
    expect(() => toModelMetadata(null)).toThrow(/not an object/);
  });
});
