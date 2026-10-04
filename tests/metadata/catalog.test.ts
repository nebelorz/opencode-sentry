import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CATALOG_PROVIDER, CATALOG_URL, fetchCatalogProvider } from "../../src/metadata/catalog";
import type { FetchLike } from "../../src/collector/fetch";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, `${name}.json`), "utf8");
}

function serve(body: string, status = 200): FetchLike {
  return async () => new Response(body, { status });
}

describe("fetchCatalogProvider", () => {
  it("returns the opencode-go models from the catalog", async () => {
    const models = await fetchCatalogProvider(serve(fixture("models-dev.catalog")));

    expect(Object.keys(models)).toContain("opencode/kimi-k2.5");
    expect(models["opencode/glm-4.6"]).toMatchObject({ id: "opencode/glm-4.6" });
  });

  it("requests the models.dev catalog URL by default", async () => {
    let requested = "";
    const fetchImpl: FetchLike = async (url) => {
      requested = url;
      return new Response(fixture("models-dev.catalog"), { status: 200 });
    };

    await fetchCatalogProvider(fetchImpl);

    expect(requested).toBe(CATALOG_URL);
    expect(CATALOG_PROVIDER).toBe("opencode-go");
  });

  it("fails loudly when the request is rejected", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("network down");
    };

    await expect(fetchCatalogProvider(fetchImpl)).rejects.toThrow(/network down/);
  });

  it("fails loudly on a non-success response", async () => {
    await expect(fetchCatalogProvider(serve("server error", 500))).rejects.toThrow(/HTTP 500/);
  });

  it("fails loudly when the body is not valid JSON", async () => {
    await expect(fetchCatalogProvider(serve("<html>not json</html>"))).rejects.toThrow(
      /Failed to parse/,
    );
  });

  it("fails loudly when the body is not an object", async () => {
    await expect(fetchCatalogProvider(serve("[]"))).rejects.toThrow(/not an object/);
  });

  it("fails loudly when the provider is missing", async () => {
    await expect(
      fetchCatalogProvider(serve(fixture("models-dev.missing-provider"))),
    ).rejects.toThrow(/missing the "opencode-go" provider/);
  });
});
