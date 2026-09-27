import { describe, expect, it } from "vitest";

import { nameKey, quotaCell } from "../../src/collector/normalize";

describe("nameKey", () => {
  it("trims surrounding whitespace", () => {
    expect(nameKey("  Kimi K2.5  ")).toBe("Kimi K2.5");
  });

  it("collapses repeated whitespace to a single space", () => {
    expect(nameKey("Kimi   K2.5")).toBe("Kimi K2.5");
  });

  it("collapses non-breaking and other HTML whitespace", () => {
    expect(nameKey("Kimi\u00A0K2.5")).toBe("Kimi K2.5");
    expect(nameKey("Kimi\u2003\u2003K2.5")).toBe("Kimi K2.5");
  });

  it("leaves a normalization-stable name unchanged", () => {
    expect(nameKey("Kimi K2.5")).toBe("Kimi K2.5");
  });
});

describe("quotaCell", () => {
  it("removes thousands separators", () => {
    expect(quotaCell("150,400")).toBe(150400);
    expect(quotaCell("1,500")).toBe(1500);
  });

  it("trims surrounding whitespace", () => {
    expect(quotaCell("  40,000  ")).toBe(40000);
  });

  it("represents Unlimited explicitly", () => {
    expect(quotaCell("Unlimited")).toBe("unlimited");
    expect(quotaCell(" unlimited ")).toBe("unlimited");
  });

  it("accepts zero and other non-negative integers", () => {
    expect(quotaCell("0")).toBe(0);
    expect(quotaCell("500")).toBe(500);
  });

  it("throws on placeholders", () => {
    expect(() => quotaCell("-")).toThrow();
    expect(() => quotaCell("N/A")).toThrow();
    expect(() => quotaCell("TBD")).toThrow();
  });

  it("throws on decimal values", () => {
    expect(() => quotaCell("1.5")).toThrow();
  });

  it("throws on negative values", () => {
    expect(() => quotaCell("-3")).toThrow();
  });

  it("throws on empty values", () => {
    expect(() => quotaCell("")).toThrow();
    expect(() => quotaCell("   ")).toThrow();
  });
});
