import { Hono } from "hono";

import { changeReportSchema } from "../schema/change.ts";
import { snapshotSchema } from "../schema/snapshot.ts";
import { latestChangeReport, latestSnapshot } from "./data.ts";

export interface LatestData {
  snapshot: unknown;
  changes: unknown;
}

const DEFAULT_DATA: LatestData = {
  snapshot: latestSnapshot,
  changes: latestChangeReport,
};

const CACHE_CONTROL = "public, max-age=3600";

export function createApp(data: LatestData = DEFAULT_DATA): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/api/v1/current", (c) => {
    if (data.snapshot === undefined) {
      return c.json({ error: "Current snapshot unavailable" }, 503);
    }

    const result = snapshotSchema.safeParse(data.snapshot);
    if (!result.success) {
      return c.json({ error: "Current snapshot unavailable" }, 500);
    }

    return c.json(result.data, 200, { "Cache-Control": CACHE_CONTROL });
  });

  app.get("/api/v1/changes", (c) => {
    if (data.changes === undefined) {
      return c.json({ error: "Change report unavailable" }, 503);
    }

    const result = changeReportSchema.safeParse(data.changes);
    if (!result.success) {
      return c.json({ error: "Change report unavailable" }, 500);
    }

    return c.json(result.data, 200, { "Cache-Control": CACHE_CONTROL });
  });

  return app;
}

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler;
