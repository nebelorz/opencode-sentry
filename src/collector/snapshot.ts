import { snapshotSchema, type Snapshot, type SnapshotModel } from "../schema/snapshot.ts";

export const SOURCE_URL = "https://opencode.ai/v2/docs/console/go";

function canonicalUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}

export function buildSnapshot(
  models: SnapshotModel[],
  scrapedAt: Date,
  url: string = SOURCE_URL,
): Snapshot {
  const candidate = {
    schemaVersion: 1,
    source: {
      provider: "opencode",
      plan: "go",
      url: canonicalUrl(url),
    },
    scrapedAt: scrapedAt.toISOString(),
    models,
  };

  return snapshotSchema.parse(candidate);
}
