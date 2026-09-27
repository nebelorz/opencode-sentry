import { pathToFileURL } from "node:url";

import { collectQuotaSnapshot } from "../collector/index.ts";

export interface CollectIo {
  log(message: string): void;
  error(message: string): void;
}

export async function runCollect(
  collect: () => Promise<string> = collectQuotaSnapshot,
  io: CollectIo = console,
): Promise<number> {
  try {
    const path = await collect();
    io.log(`Snapshot created: ${path}`);
    return 0;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCollect();
}
