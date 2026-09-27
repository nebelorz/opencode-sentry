import { changeReportSchema, type ChangeReport } from "../schema/change.ts";
import { compareSnapshots } from "./compare.ts";
import { loadSnapshots, selectLatestTwo } from "./load.ts";
import { persistChangeReport } from "./persist.ts";

export interface DiffOptions {
  snapshotsDir?: string;
  changesDir?: string;
}

export type DiffPipeline = () => Promise<string>;

export async function runDiffPipeline(options: DiffOptions = {}): Promise<string> {
  const { snapshotsDir = "data/snapshots", changesDir = "data/changes" } = options;

  const loaded = await loadSnapshots(snapshotsDir);
  const [previous, latest] = selectLatestTwo(loaded);

  const report: ChangeReport = {
    schemaVersion: 1,
    from: previous.scrapedAt,
    to: latest.scrapedAt,
    changes: compareSnapshots(previous, latest),
  };

  const validated = changeReportSchema.parse(report);

  return persistChangeReport(validated, changesDir);
}
