import { fetchHtml, type FetchLike } from "./fetch";
import { matchModels } from "./match";
import { parseEndpoints, parseEstimatedRequests } from "./parse";
import { persistSnapshot } from "./persist";
import { buildSnapshot, SOURCE_URL } from "./snapshot";

export interface CollectOptions {
  fetchImpl?: FetchLike;
  now?: () => Date;
  url?: string;
  outputDir?: string;
}

export async function collectQuotaSnapshot(options: CollectOptions = {}): Promise<string> {
  const { fetchImpl = fetch, now = () => new Date(), url = SOURCE_URL, outputDir } = options;

  const html = await fetchHtml(url, fetchImpl);
  const estimated = parseEstimatedRequests(html);
  const endpoints = parseEndpoints(html);
  const models = matchModels(estimated, endpoints);
  const snapshot = buildSnapshot(models, now(), url);

  return persistSnapshot(snapshot, outputDir);
}

export { SOURCE_URL };
export type { FetchLike };
