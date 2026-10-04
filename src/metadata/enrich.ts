import type { FetchLike } from "../collector/fetch.ts";
import type { SnapshotModel } from "../schema/snapshot.ts";
import { fetchCatalogProvider, type CatalogModels } from "./catalog.ts";
import { toModelMetadata } from "./map.ts";

export function attachMetadata(models: SnapshotModel[], catalog: CatalogModels): SnapshotModel[] {
  return models.map((model) => {
    if (!Object.prototype.hasOwnProperty.call(catalog, model.id)) {
      return model;
    }
    return { ...model, metadata: toModelMetadata(catalog[model.id]) };
  });
}

export async function enrichModels(
  models: SnapshotModel[],
  fetchImpl: FetchLike = fetch,
): Promise<SnapshotModel[]> {
  const catalog = await fetchCatalogProvider(fetchImpl);
  return attachMetadata(models, catalog);
}
