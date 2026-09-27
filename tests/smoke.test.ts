import { describe, expect, it } from "vitest";

import worker from "../src/api/index";

describe("stub worker", () => {
  it("returns 404 for undefined routes", async () => {
    const response = await worker.fetch(new Request("https://example.com/"));

    expect(response.status).toBe(404);
  });
});
