import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { snapshotSchema, type Snapshot } from "../schema/snapshot.ts";

export interface LoadedSnapshot {
  filename: string;
  snapshot: Snapshot;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadSnapshots(dir: string): Promise<LoadedSnapshot[]> {
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  const loaded: LoadedSnapshot[] = [];

  for (const filename of names) {
    let contents: string;
    try {
      contents = await readFile(join(dir, filename), "utf8");
    } catch (error) {
      throw new Error(`Unable to read snapshot file ${filename}: ${message(error)}`);
    }

    let data: unknown;
    try {
      data = JSON.parse(contents);
    } catch (error) {
      throw new Error(`Unable to parse snapshot file ${filename}: ${message(error)}`);
    }

    const result = snapshotSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid snapshot file ${filename}: ${result.error.message}`);
    }

    loaded.push({ filename, snapshot: result.data });
  }

  return loaded;
}

export function selectLatestTwo(snapshots: LoadedSnapshot[]): [Snapshot, Snapshot] {
  if (snapshots.length < 2) {
    throw new Error("Cannot compute diff: at least two snapshots are required");
  }

  const ordered = [...snapshots].sort((a, b) => {
    const byTime = Date.parse(a.snapshot.scrapedAt) - Date.parse(b.snapshot.scrapedAt);
    if (byTime !== 0) {
      return byTime;
    }
    if (a.filename < b.filename) {
      return -1;
    }
    if (a.filename > b.filename) {
      return 1;
    }
    return 0;
  });

  return [ordered[ordered.length - 2]!.snapshot, ordered[ordered.length - 1]!.snapshot];
}
