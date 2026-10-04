import type { FetchLike } from "../collector/fetch.ts";

export const CATALOG_URL = "https://models.dev/api.json";
export const CATALOG_PROVIDER = "opencode-go";

export type CatalogModels = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function fetchCatalogProvider(
  fetchImpl: FetchLike = fetch,
  url: string = CATALOG_URL,
): Promise<CatalogModels> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch models.dev catalog ${url}: ${reason}`);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch models.dev catalog ${url}: HTTP ${response.status} ${response.statusText}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse models.dev catalog ${url}: ${reason}`);
  }

  if (!isRecord(body)) {
    throw new Error(`models.dev catalog ${url} is not an object`);
  }

  const provider = body[CATALOG_PROVIDER];
  if (!isRecord(provider) || !isRecord(provider.models)) {
    throw new Error(`models.dev catalog is missing the "${CATALOG_PROVIDER}" provider`);
  }

  return provider.models;
}
