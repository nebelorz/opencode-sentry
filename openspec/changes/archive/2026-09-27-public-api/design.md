## Context

See `proposal.md` for motivation and `specs/public-api/spec.md` for the behavior contract.

The pipeline is already in place: `pnpm collect` writes an immutable, validated snapshot to `data/snapshots/<timestamp>.json` (minute-precision UTC, `:` replaced by `-`), and `pnpm diff` writes an immutable, validated change report to `data/changes/<timestamp>.json`. Both filenames are lexicographically chronological, which `src/diff/load.ts` already relies on to select the latest snapshots. `src/schema/snapshot.ts` exports `snapshotSchema` + `Snapshot`; `src/schema/change.ts` exports `changeReportSchema` + `ChangeReport`. `wrangler.jsonc` points at `src/api/index.ts`, which is currently a stub exporting `{ fetch: app.fetch }`. The existing smoke test asserts `/` returns `404`.

Constraints from `AGENTS.md`, `EXECUTIVE_SUMMARY.md`, and the request: the API is a thin, read-only presentation layer; it must not scrape, parse, normalize, snapshot, or diff; it must reuse the existing Zod schemas; it must not introduce a database or external storage; it must preserve immutable historical files; and it must introduce no repository/service/factory/DI abstraction. `data/` is committed to Git.

The one structural constraint that drives the whole design: a Cloudflare Worker has no runtime filesystem, so the generated JSON must become available to the Worker as part of its deployable bundle, not through `fs` reads at request time.

## Goals / Non-Goals

**Goals:**

- Two read-only endpoints (`GET /api/v1/current`, `GET /api/v1/changes`) backed by already-generated, already-validated JSON.
- A deterministic latest-data resolution with no request-time scanning and no request-time "newest" calculation.
- Reuse of the existing snapshot and change-report schemas for request-time validation.
- A Worker bundle that stays small regardless of how much history accumulates.
- A clean seam so tests use local fixtures through Hono's request utilities.

**Non-Goals:**

- No POST/PUT/PATCH/DELETE, no extra versioned routes, no query parameters.
- No database, R2, KV, or D1; no CORS configuration; no authentication.
- No GitHub Actions scheduling, auto-commit, or deployment (the `deployment` change).
- No changes to collector, diff, CLI, or schema behavior.
- No application-level cache; caching is HTTP-only via headers.

## Decisions

**1. Module layout: thin routes plus a committed data index plus a build-time sync step.**

```text
src/api/index.ts        createApp(data?): Hono app; default export { fetch }   (routes, validation, errors, caching)
src/api/data.ts         committed index: static JSON imports -> latestSnapshot, latestChangeReport
src/cli/api-data.ts     api:data sync step: resolve latest, validate, write data/latest.json + src/api/data.ts
data/latest.json        committed pointer: { "snapshot": "...", "changes": "..." }
tests/api/index.test.ts endpoint tests (Hono app.request + fixtures)
tests/cli/api-data.test.ts sync step tests
tests/fixtures/api/     valid/invalid snapshot and change-report JSON fixtures
```

The Worker imports only `src/api/index.ts` and its transitive imports (`src/api/data.ts`, the two schemas, and the two referenced JSON files). The sync step (`src/cli/api-data.ts`) is a Node-only build/pipeline step, mirroring `src/cli/collect.ts` and `src/cli/diff.ts`; it is never part of the Worker bundle because the Worker never imports it.

**2. Latest-data resolution: a pointer file plus a bundled index, not request-time scanning.**

The Worker must be able to answer "what is latest" without scanning `data/` at request time. Two artifacts achieve this:

- `data/latest.json` is a committed pointer that records the relative filenames of the latest snapshot and latest change report:

```json
{ "snapshot": "snapshots/2026-09-27T17-38.json", "changes": "changes/2026-09-27T17-38.json" }
```

It points to files; it does not duplicate data.

- `src/api/data.ts` is a committed index module that statically imports exactly those two JSON files and re-exports them:

```ts
import snapshot from "../../data/snapshots/2026-09-27T17-38.json";
import changes from "../../data/changes/2026-09-27T17-38.json";

export const latestSnapshot: unknown = snapshot;
export const latestChangeReport: unknown = changes;
```

The Worker reads `latestSnapshot`/`latestChangeReport` directly; there is no directory scan and no timestamp comparison at request time. Because only the two referenced files are imported, the bundle stays small even as `data/` accumulates history.

Alternative considered: runtime `readdir`/sort in the Worker. Rejected because Workers have no filesystem. Alternative considered: bundle the entire `data/` tree. Rejected because it grows the deploy with all history, defeating "latest only". Alternative considered: serving `data/` via Cloudflare static assets and fetching `latest.json` at request time. Rejected for the MVP: it adds asset routing/binding configuration and an extra fetch to mock in tests, for no benefit at this scale. Alternative considered: R2/KV/D1. Rejected; the data is a few KB and Git + bundle suffice.

**3. The `api:data` sync step keeps the pointer and index consistent and validated.**

`src/cli/api-data.ts` (run via `node src/cli/api-data.ts`, exposed as `"api:data"`) is the single build-time integration point:

1. Determine the latest snapshot (lexicographically greatest `data/snapshots/*.json`) and the latest change report (lexicographically greatest `data/changes/*.json`), using the existing filename convention where lexicographic order equals chronological order. This is a build/pipeline-time operation, not the Worker, so it does not violate the "no request-time scanning" requirement.
2. Parse and validate both against the existing `snapshotSchema` and `changeReportSchema`. Fail with a non-zero exit if a directory is empty, a file is unreadable, JSON is malformed, or validation fails.
3. Write `data/latest.json` and rewrite `src/api/data.ts` (imports only; no data duplication). Both outputs are committed, so `pnpm typecheck`, `pnpm test`, and `wrangler deploy` work from a clean checkout.

The future GitHub Actions pipeline runs `collect` -> `diff` -> `api:data` -> deploy; scheduling and commits are out of scope. The sync step is idempotent and deterministic: given the same data directories it produces the same pointer and index.

Alternative considered: have the collector and diff update `latest.json`/`data.ts` directly. Rejected to avoid touching the already-archived `quota-scraper`, `collector-cli`, and `snapshot-diff` changes; a standalone sync step keeps this change self-contained and reusable by the future pipeline.

**4. Request-time validation reuses the existing schemas.**

Each handler runs `snapshotSchema.safeParse` / `changeReportSchema.safeParse` on the imported object before returning it. Validation is per-request (the payload is a few KB, so the cost is negligible) and no application-level cache holds the parsed result, per the non-goal against application caching. `src/api/data.ts` types its exports as `unknown` so the schemas, not the JSON-import type inference, are the source of validation truth. The sync step is a first line of defense; request-time validation is the required second line so a corrupt committed file yields a `5xx`, not a crash or invalid payload.

**5. Route and handler shape.**

```ts
// src/api/index.ts
import { Hono } from "hono";
import { snapshotSchema } from "../schema/snapshot.ts";
import { changeReportSchema } from "../schema/change.ts";
import { latestSnapshot, latestChangeReport } from "./data.ts";

export interface LatestData {
  snapshot: unknown;
  changes: unknown;
}

const DEFAULT_DATA: LatestData = { snapshot: latestSnapshot, changes: latestChangeReport };
const CACHE_CONTROL = "public, max-age=3600";

export function createApp(data: LatestData = DEFAULT_DATA): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/api/v1/current", (c) => {
    if (data.snapshot === undefined) return c.json({ error: "Current snapshot unavailable" }, 503);
    const result = snapshotSchema.safeParse(data.snapshot);
    if (!result.success) return c.json({ error: "Current snapshot unavailable" }, 500);
    return c.json(result.data, 200, { "Cache-Control": CACHE_CONTROL });
  });

  app.get("/api/v1/changes", (c) => {
    if (data.changes === undefined) return c.json({ error: "Change report unavailable" }, 503);
    const result = changeReportSchema.safeParse(data.changes);
    if (!result.success) return c.json({ error: "Change report unavailable" }, 500);
    return c.json(result.data, 200, { "Cache-Control": CACHE_CONTROL });
  });

  return app;
}

const app = createApp();
export default { fetch: app.fetch } satisfies ExportedHandler;
```

The default export preserves the existing `{ fetch }` shape so the smoke test and `wrangler.jsonc` keep working. `createApp(data)` is the injection seam: tests pass fixtures for `snapshot`/`changes`, including `undefined` for the unavailable case and malformed objects for the invalid case.

**6. HTTP behavior.**

- Success: `200`.
- Unavailable (the pointer/index does not resolve or the data is `undefined`): `503`.
- Invalid (stored JSON fails schema validation): `500`.

Both error classes use the same single-field JSON body, e.g. `{ "error": "Current snapshot unavailable" }`. The status code, not the message, distinguishes "not available yet" from "integrity error". Messages contain no filesystem paths, stack traces, or implementation detail. No error framework, no `Content-Type` beyond Hono's default JSON, no `HEAD`/`OPTIONS` special-casing.

**7. Caching headers.**

Success responses set `Cache-Control: public, max-age=3600`. Data changes only when a new collection is published (twice daily), so a one-hour TTL is conservative and lets Cloudflare's HTTP cache serve repeat reads. This is normal HTTP caching; there is no cache database, no application cache, and no invalidation logic. Error responses set no caching header, so clients re-read after failures. `public` is appropriate because the endpoints are unauthenticated and shared; `s-maxage`/`stale-while-revalidate` are intentionally omitted for the MVP.

**8. Health endpoint.**

`GET /health` returns `200 { "status": "ok" }`. It is outside `/api/v1`, is not cached, and is not a readiness/deep-check. Root `/` remains `404`, preserving the existing smoke test's expectation. No CORS is configured: the intended consumers are AI agents and server-side clients, and there is no browser-access requirement. If a concrete browser consumer appears later, permissive CORS can be added as its own change.

**9. Testing strategy.**

- `tests/api/index.test.ts` constructs `createApp({ snapshot, changes })` and calls `app.request("/api/v1/current")` / `app.request("/api/v1/changes")` (Hono's built-in request utility, no real server). Fixtures under `tests/fixtures/api/` provide a valid snapshot, a valid change report, an invalid snapshot, and an invalid change report.
- Cases: `200` valid snapshot; `200` valid change report; `503` when `snapshot`/`changes` is `undefined`; `500` when the fixture is schema-invalid; error body matches `{ "error": string }`; success responses include `Cache-Control`; `/health` returns `200`.
- `tests/cli/api-data.test.ts` runs the sync step against temporary directories (like the diff tests) and asserts it selects the newest file, writes `latest.json` and a valid `data.ts`, and fails non-zero on empty/missing/invalid input.
- An additional guard test asserts the API module graph contains no `fetch` to the OpenCode source and no import of collector/diff modules, giving an automated check for the "no scraping/diff in the Worker" requirement.
- No test contacts the live OpenCode website.

## Risks / Trade-offs

- Static JSON imports reference files under `data/`, outside `tsconfig.json`'s `include`. `resolveJsonModule` is already enabled and TypeScript resolves imported JSON regardless of `include`, so `pnpm typecheck` passes. If a future tsconfig/tooling change breaks this, fall back to generating `src/api/data.ts` with the data inlined as `satisfies Snapshot`/`satisfies ChangeReport` literals (self-contained within `src/`, at the cost of duplicating ~KB of data into a committed artifact). The sync step isolates this change to one file.
- `data.ts` is generated but committed, so it can drift from `data/`. Mitigation: the sync step rewrites it deterministically and CI can run `api:data` and assert no diff, if desired later.
- The sync step selects "latest" by lexicographic filename order, which equals chronological order only while the minute-precision UTC convention holds. Mitigation: the convention is already relied on by `src/diff/load.ts` and is asserted by the collector/diff tests; the sync step also validates content, so a mis-selected file still surfaces via schema/consistency checks.
- There is no change report in `data/changes/` yet (the diff has not been run against the two existing snapshots), so `src/api/data.ts` cannot import a changes file until one exists. Mitigation: implementation either runs `pnpm diff` first to produce the first report, or the tasks seed `data/changes/` from the existing snapshots; tests use fixtures and are unaffected.
- Two `5xx` codes (503 vs 500) add a small amount of surface. This is the minimal distinction the request asks for ("unavailable" vs "integrity error") and is covered by tests; it is not an error framework.

## Migration Plan

Additive only. New files under `src/api/`, `src/cli/api-data.ts`, `data/latest.json`, and new tests/fixtures; `src/api/index.ts` grows from a stub into `createApp` while preserving its default `{ fetch }` export. One new `package.json` script (`api:data`) and, optionally, wiring it into `build` so deploy validates data. No existing data, schema, collector, diff, CLI, or wrangler behavior changes. Rollback is deleting the new files and reverting `index.ts` and `package.json`; historical snapshots/reports and the pipeline are untouched.
