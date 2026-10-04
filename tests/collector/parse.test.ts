import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseEndpoints, parseEstimatedRequests, parsePricing } from "../../src/collector/parse";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.html`), "utf8");
}

describe("parseEstimatedRequests", () => {
  it("maps the header row and returns raw data rows for the valid fixture", () => {
    const table = parseEstimatedRequests(fixture("opencode-go.valid"));

    expect(table.modelIndex).toBe(0);
    expect(table.fiveHourIndex).toBe(1);
    expect(table.weeklyIndex).toBe(2);
    expect(table.monthlyIndex).toBe(3);
    expect(table.rows).toHaveLength(4);
    expect(table.rows[0]).toEqual(["Kimi K2.5", "1,500", "12,000", "40,000"]);
  });

  it("maps columns regardless of order for the reordered fixture", () => {
    const table = parseEstimatedRequests(fixture("opencode-go.reordered-headers"));

    expect(table.modelIndex).toBe(0);
    expect(table.monthlyIndex).toBe(1);
    expect(table.fiveHourIndex).toBe(2);
    expect(table.weeklyIndex).toBe(3);
    expect(table.rows[0]).toEqual(["Kimi K2.5", "40,000", "1,500", "12,000"]);
  });

  it("throws when the section is missing", () => {
    expect(() => parseEstimatedRequests(fixture("opencode-go.estimated-missing-section"))).toThrow(
      /section not found/,
    );
  });

  it("throws when the table is missing", () => {
    expect(() => parseEstimatedRequests(fixture("opencode-go.estimated-missing-table"))).toThrow(
      /table not found/,
    );
  });

  it("throws when the table has no data rows", () => {
    expect(() => parseEstimatedRequests(fixture("opencode-go.estimated-empty-table"))).toThrow(
      /no data rows/,
    );
  });

  it("throws when the table cannot be read as header plus rows", () => {
    expect(() => parseEstimatedRequests(fixture("opencode-go.estimated-malformed-table"))).toThrow(
      /header row not found/,
    );
  });

  it("throws when a required header is absent", () => {
    expect(() => parseEstimatedRequests(fixture("opencode-go.estimated-missing-header"))).toThrow(
      /weekly header/,
    );
  });

  it("throws when a row has a mismatched number of cells", () => {
    expect(() => parseEstimatedRequests(fixture("opencode-go.estimated-mismatched-row"))).toThrow(
      /mismatched number of cells/,
    );
  });
});

describe("parseEndpoints", () => {
  it("returns model name and model ID pairs and ignores other columns", () => {
    const entries = parseEndpoints(fixture("opencode-go.valid"));

    expect(entries).toEqual([
      { name: "Kimi K2.5", id: "opencode/kimi-k2.5" },
      { name: "GLM-4.6", id: "opencode/glm-4.6" },
      { name: "MiniMax M2", id: "opencode/minimax-m2" },
      { name: "Qwen3 Coder", id: "opencode/qwen3-coder" },
    ]);
  });

  it("maps columns regardless of order for the reordered fixture", () => {
    const entries = parseEndpoints(fixture("opencode-go.reordered-headers"));

    expect(entries).toEqual([
      { name: "Kimi K2.5", id: "opencode/kimi-k2.5" },
      { name: "GLM-4.6", id: "opencode/glm-4.6" },
      { name: "MiniMax M2", id: "opencode/minimax-m2" },
      { name: "Qwen3 Coder", id: "opencode/qwen3-coder" },
    ]);
  });

  it("throws when the section is missing", () => {
    expect(() => parseEndpoints(fixture("opencode-go.endpoints-missing-section"))).toThrow(
      /section not found/,
    );
  });

  it("throws when the table is missing", () => {
    expect(() => parseEndpoints(fixture("opencode-go.endpoints-missing-table"))).toThrow(
      /table not found/,
    );
  });

  it("throws when the Model header is absent", () => {
    expect(() => parseEndpoints(fixture("opencode-go.endpoints-missing-model-header"))).toThrow(
      /Model header/,
    );
  });

  it("throws when the Model ID header is absent", () => {
    expect(() => parseEndpoints(fixture("opencode-go.endpoints-missing-id-header"))).toThrow(
      /Model ID header/,
    );
  });

  it("throws when the table has no data rows", () => {
    expect(() => parseEndpoints(fixture("opencode-go.endpoints-empty-table"))).toThrow(
      /no data rows/,
    );
  });

  it("throws when a row is malformed", () => {
    expect(() => parseEndpoints(fixture("opencode-go.endpoints-malformed-table"))).toThrow(
      /mismatched number of cells/,
    );
  });

  it("throws on duplicate model names", () => {
    expect(() => parseEndpoints(fixture("opencode-go.endpoints-duplicate-name"))).toThrow(
      /Duplicate model name/,
    );
  });

  it("throws on duplicate model IDs", () => {
    expect(() => parseEndpoints(fixture("opencode-go.endpoints-duplicate-id"))).toThrow(
      /Duplicate model id/,
    );
  });
});

describe("parsePricing", () => {
  it("locates both plan tables and associates each row with its plan", () => {
    const rows = parsePricing(fixture("opencode-go.valid"));

    expect(rows).toHaveLength(8);
    expect(rows.filter((row) => row.plan === "go")).toHaveLength(4);
    expect(rows.filter((row) => row.plan === "go-plus")).toHaveLength(4);
    expect(rows[0]).toEqual({
      plan: "go",
      baseName: "Kimi K2.5",
      variant: "default",
      variantLabel: "Default",
      input: "$0.95",
      output: "$4.00",
      cachedRead: "$0.16",
      cachedWrite: "-",
      monthlyLimit: "$60",
    });
  });

  it("derives default, peak, off-peak, and token-tier variants", () => {
    const rows = parsePricing(fixture("opencode-go.pricing-variants"));
    const findRow = (plan: string, variant: string) =>
      rows.find((row) => row.plan === plan && row.variant === variant);

    expect(findRow("go", "off-peak")).toMatchObject({
      baseName: "DeepSeek V4.1 Flash",
      variantLabel: "Off-Peak",
    });
    expect(findRow("go", "peak")).toMatchObject({
      baseName: "DeepSeek V4.1 Flash",
      variantLabel: "Peak",
    });
    expect(findRow("go", "le-256k")).toMatchObject({
      baseName: "Qwen3.7 Plus",
      variantLabel: "≤ 256K tokens",
    });
    expect(findRow("go", "gt-256k")).toMatchObject({
      baseName: "Qwen3.7 Plus",
      variantLabel: "> 256K tokens",
    });
    expect(findRow("go", "default")).toMatchObject({
      baseName: "Kimi K2.5",
      variantLabel: "Default",
    });
    expect(findRow("go-plus", "off-peak")).toBeDefined();
    expect(findRow("go-plus", "gt-256k")).toBeDefined();
  });

  it("maps columns regardless of order", () => {
    const rows = parsePricing(fixture("opencode-go.pricing-reordered"));

    expect(rows[0]).toEqual({
      plan: "go",
      baseName: "Kimi K2.5",
      variant: "default",
      variantLabel: "Default",
      input: "$0.95",
      output: "$4.00",
      cachedRead: "$0.16",
      cachedWrite: "-",
      monthlyLimit: "$60",
    });
  });

  it("throws when both plan tables are missing", () => {
    expect(() => parsePricing(fixture("opencode-go.pricing-missing-table"))).toThrow(
      /not found for both plans/,
    );
  });

  it("throws when one plan table is missing", () => {
    expect(() => parsePricing(fixture("opencode-go.pricing-missing-plan"))).toThrow(
      /not found for both plans/,
    );
  });

  it("throws when a required header is missing", () => {
    expect(() => parsePricing(fixture("opencode-go.pricing-missing-header"))).toThrow(
      /not found for both plans/,
    );
  });
});
