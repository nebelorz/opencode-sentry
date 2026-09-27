import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Snapshot } from "../schema/snapshot.ts";

export function snapshotFilename(scrapedAt: string): string {
  const minute = new Date(scrapedAt).toISOString().slice(0, 16);
  return `${minute.replace(/:/g, "-")}.json`;
}

export async function persistSnapshot(
  snapshot: Snapshot,
  outputDir = "data/snapshots",
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const path = join(outputDir, snapshotFilename(snapshot.scrapedAt));
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;

  await writeFile(path, json, { encoding: "utf8", flag: "wx" });

  return path;
}
