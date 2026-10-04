import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

import type { ZodType } from "zod";

import { changeReportSchema } from "../schema/change.ts";
import { snapshotSchema } from "../schema/snapshot.ts";

export interface LatestOptions {
  snapshotsDir?: string;
  changesDir?: string;
  latestPath?: string;
}

export interface LatestIo {
  log(message: string): void;
  error(message: string): void;
}

export interface LatestPointer {
  snapshot: string;
  changes: string;
}

const DEFAULT_SNAPSHOTS_DIR = "data/snapshots";
const DEFAULT_CHANGES_DIR = "data/changes";
const DEFAULT_LATEST_PATH = "data/latest.json";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

async function selectNewest(dir: string, label: string): Promise<string> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    throw new Error(`Unable to read ${label} directory ${dir}: ${message(error)}`);
  }

  const newest = names.at(-1);
  if (newest === undefined) {
    throw new Error(`No ${label} files found in ${dir}`);
  }

  return newest;
}

async function validateFile(path: string, schema: ZodType, label: string): Promise<void> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Unable to read ${label} file ${path}: ${message(error)}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Unable to parse ${label} file ${path}: ${message(error)}`);
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid ${label} file ${path}: ${result.error.message}`);
  }
}

export async function syncLatest(options: LatestOptions = {}): Promise<LatestPointer> {
  const snapshotsDir = options.snapshotsDir ?? DEFAULT_SNAPSHOTS_DIR;
  const changesDir = options.changesDir ?? DEFAULT_CHANGES_DIR;
  const latestPath = options.latestPath ?? DEFAULT_LATEST_PATH;

  const snapshotName = await selectNewest(snapshotsDir, "snapshot");
  const changesName = await selectNewest(changesDir, "change report");

  const snapshotPath = join(snapshotsDir, snapshotName);
  const changesPath = join(changesDir, changesName);

  await validateFile(snapshotPath, snapshotSchema, "snapshot");
  await validateFile(changesPath, changeReportSchema, "change report");

  const pointer: LatestPointer = {
    snapshot: toPosix(relative(dirname(latestPath), snapshotPath)),
    changes: toPosix(relative(dirname(latestPath), changesPath)),
  };

  await mkdir(dirname(latestPath), { recursive: true });
  await writeFile(latestPath, `${JSON.stringify(pointer, null, 2)}\n`, "utf8");

  return pointer;
}

export async function runLatest(
  options: LatestOptions = {},
  io: LatestIo = console,
): Promise<number> {
  try {
    const pointer = await syncLatest(options);
    io.log(`Latest pointer synced: ${pointer.snapshot}, ${pointer.changes}`);
    return 0;
  } catch (error) {
    io.error(message(error));
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runLatest();
}
