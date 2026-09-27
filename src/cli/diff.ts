import { pathToFileURL } from "node:url";

import { runDiffPipeline, type DiffPipeline } from "../diff/index.ts";

export interface DiffIo {
  log(message: string): void;
  error(message: string): void;
}

export async function runDiff(
  diff: DiffPipeline = runDiffPipeline,
  io: DiffIo = console,
): Promise<number> {
  try {
    const path = await diff();
    io.log(`Change report created: ${path}`);
    return 0;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runDiff();
}
