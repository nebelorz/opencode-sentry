import { describe, expect, it } from "vitest";

import { changeReportSchema } from "../../src/schema/change";

const model = { id: "opencode/kimi-k2.5", name: "Kimi K2.5" };

const estimatedRequests = {
  fiveHour: 1500,
  weekly: 12000,
  monthly: 40000,
};

function report(changes: unknown[]) {
  return {
    schemaVersion: 1,
    from: "2026-09-27T10:00:00.000Z",
    to: "2026-09-27T11:00:00.000Z",
    changes,
  };
}

describe("change report schema", () => {
  it("accepts a report containing each change type", () => {
    const parsed = changeReportSchema.parse(
      report([
        { type: "model_added", model, estimatedRequests },
        { type: "model_removed", model, previousEstimatedRequests: estimatedRequests },
        {
          type: "quota_changed",
          model,
          quota: {
            period: "weekly",
            previous: 12000,
            current: 10000,
            change: -2000,
            changePercent: -16.67,
          },
        },
      ]),
    );

    expect(parsed.changes).toHaveLength(3);
  });

  it("accepts an empty changes array", () => {
    const parsed = changeReportSchema.parse(report([]));

    expect(parsed.changes).toEqual([]);
  });

  it("accepts null change and changePercent with an unlimited value", () => {
    const parsed = changeReportSchema.parse(
      report([
        {
          type: "quota_changed",
          model,
          quota: {
            period: "monthly",
            previous: "unlimited",
            current: 40000,
            change: null,
            changePercent: null,
          },
        },
      ]),
    );

    expect(parsed.changes[0]).toMatchObject({
      quota: { previous: "unlimited", change: null, changePercent: null },
    });
  });

  it("rejects an unknown change type", () => {
    expect(() => changeReportSchema.parse(report([{ type: "model_renamed", model }]))).toThrow();
  });

  it("rejects an unexpected schemaVersion", () => {
    expect(() => changeReportSchema.parse({ ...report([]), schemaVersion: 2 })).toThrow();
  });

  it("rejects a non-null changePercent paired with a non-number", () => {
    expect(() =>
      changeReportSchema.parse(
        report([
          {
            type: "quota_changed",
            model,
            quota: {
              period: "weekly",
              previous: 12000,
              current: "unlimited",
              change: null,
              changePercent: "-100",
            },
          },
        ]),
      ),
    ).toThrow();
  });
});
