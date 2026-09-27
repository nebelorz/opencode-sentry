import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createApp, type LatestData } from "../../src/api/index";
import invalidChangeReport from "../fixtures/api/change-report.invalid.json";
import validChangeReport from "../fixtures/api/change-report.valid.json";
import invalidSnapshot from "../fixtures/api/snapshot.invalid.json";
import validSnapshot from "../fixtures/api/snapshot.valid.json";

function appFor(data: LatestData) {
  return createApp(data);
}

describe("GET /api/v1/current", () => {
  it("returns 200 with the stored snapshot when valid", async () => {
    const app = appFor({ snapshot: validSnapshot, changes: validChangeReport });

    const response = await app.request("/api/v1/current");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(validSnapshot);
  });

  it("includes a Cache-Control header on success", async () => {
    const app = appFor({ snapshot: validSnapshot, changes: validChangeReport });

    const response = await app.request("/api/v1/current");

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("returns 503 without caching when no snapshot is available", async () => {
    const app = appFor({ snapshot: undefined, changes: validChangeReport });

    const response = await app.request("/api/v1/current");

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it("returns 500 without caching when the snapshot is invalid", async () => {
    const app = appFor({ snapshot: invalidSnapshot, changes: validChangeReport });

    const response = await app.request("/api/v1/current");

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });
});

describe("GET /api/v1/changes", () => {
  it("returns 200 with the stored change report when valid", async () => {
    const app = appFor({ snapshot: validSnapshot, changes: validChangeReport });

    const response = await app.request("/api/v1/changes");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(validChangeReport);
  });

  it("includes a Cache-Control header on success", async () => {
    const app = appFor({ snapshot: validSnapshot, changes: validChangeReport });

    const response = await app.request("/api/v1/changes");

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
  });

  it("returns 503 without caching when no change report is available", async () => {
    const app = appFor({ snapshot: validSnapshot, changes: undefined });

    const response = await app.request("/api/v1/changes");

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });

  it("returns 500 without caching when the change report is invalid", async () => {
    const app = appFor({ snapshot: validSnapshot, changes: invalidChangeReport });

    const response = await app.request("/api/v1/changes");

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(await response.json()).toEqual({ error: expect.any(String) });
  });
});

describe("error responses", () => {
  it("use a single error string field with no internal details", async () => {
    const cases = [
      appFor({ snapshot: undefined, changes: validChangeReport }),
      appFor({ snapshot: invalidSnapshot, changes: validChangeReport }),
      appFor({ snapshot: validSnapshot, changes: undefined }),
      appFor({ snapshot: validSnapshot, changes: invalidChangeReport }),
    ];
    const paths = ["/api/v1/current", "/api/v1/current", "/api/v1/changes", "/api/v1/changes"];

    for (const [index, app] of cases.entries()) {
      const response = await app.request(paths[index]!);
      const body = (await response.json()) as Record<string, unknown>;

      expect(Object.keys(body)).toEqual(["error"]);
      expect(typeof body.error).toBe("string");
      expect(body.error).not.toMatch(/[\\/]/);
      expect(body.error).not.toMatch(/\bat\s+\S+:\d+:\d+/);
    }
  });
});

describe("GET /health", () => {
  it("returns 200 with a fixed body outside the versioned API", async () => {
    const app = appFor({ snapshot: undefined, changes: undefined });

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

describe("API module graph", () => {
  it("contains no scraping, external fetch, or collector/diff imports", async () => {
    const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "api");
    const sources = await Promise.all([
      readFile(join(apiDir, "index.ts"), "utf8"),
      readFile(join(apiDir, "data.ts"), "utf8"),
    ]);
    const combined = sources.join("\n");

    expect(combined).not.toMatch(/from\s+["'][^"']*(collector|diff)/);
    expect(combined).not.toMatch(/\bfetch\s*\(/);
    expect(combined).not.toMatch(/opencode\.ai/);
  });
});
