import { describe, expect, it } from "vitest";

import { fetchHtml, type FetchLike } from "../../src/collector/fetch";

const url = "https://opencode.ai/v2/docs/console/go";

describe("fetchHtml", () => {
  it("returns the response body for a successful response", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("<html><body>ok</body></html>", { status: 200 });

    await expect(fetchHtml(url, fetchImpl)).resolves.toBe("<html><body>ok</body></html>");
  });

  it("throws for a non-success response", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response("server error", { status: 500, statusText: "Server Error" });

    await expect(fetchHtml(url, fetchImpl)).rejects.toThrow(/HTTP 500/);
  });

  it("throws when the request is rejected", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("network down");
    };

    await expect(fetchHtml(url, fetchImpl)).rejects.toThrow(/network down/);
  });
});
