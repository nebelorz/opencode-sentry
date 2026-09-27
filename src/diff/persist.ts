import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ChangeReport } from "../schema/change.ts";

export function reportFilename(to: string): string {
  const minute = new Date(to).toISOString().slice(0, 16);
  return `${minute.replace(/:/g, "-")}.json`;
}

export async function persistChangeReport(
  report: ChangeReport,
  outputDir = "data/changes",
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const path = join(outputDir, reportFilename(report.to));
  const json = `${JSON.stringify(report, null, 2)}\n`;

  await writeFile(path, json, { encoding: "utf8", flag: "wx" });

  return path;
}
