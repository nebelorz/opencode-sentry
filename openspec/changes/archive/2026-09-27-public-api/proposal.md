## Why

The pipeline already collects immutable quota snapshots into `data/snapshots/` and produces immutable change reports into `data/changes/`, but nothing exposes that data. Humans and AI agents still cannot answer "what are the current OpenCode Go quotas?" or "what changed since the previous check?" without reading raw files. This change adds the read-only presentation layer: a thin Cloudflare Worker that serves the latest snapshot and latest change report over HTTP.

## What Changes

- Add a Hono-based Cloudflare Worker on top of the existing `src/api/index.ts` stub, exposing two read-only endpoints: `GET /api/v1/current` and `GET /api/v1/changes`.
- `GET /api/v1/current` returns the latest validated snapshot using the existing snapshot structure (no transformation).
- `GET /api/v1/changes` returns the latest generated change report using the existing change-report structure (no diff calculation in the Worker).
- Add a deterministic latest-data resolution mechanism: a committed `data/latest.json` pointer file and a bundled index module, so the Worker never scans historical files, never computes "newest", and never runs collect or diff at request time.
- Reuse the existing Zod snapshot and change-report schemas to validate stored data before returning it; invalid or unavailable data yields a `5xx` with a small JSON error body rather than fabricated empty data.
- Add a trivial `GET /health` endpoint, separate from the versioned API.
- Add HTTP caching headers for the read-only endpoints, and define a minimal, consistent JSON error shape.
- Add offline tests (using Hono's request utilities and local fixtures) for both endpoints, the `5xx` cases, error-shape consistency, and the guarantee that the Worker performs no scraping or diff logic.

Out of scope: POST/PUT/PATCH/DELETE, `/api/v1/models`, `/api/v1/history`, `/api/v1/stats`, query parameters such as `?since=`/`?model=`/`?type=`, authentication, user accounts, database storage, R2/KV/D1, CORS configuration, a dashboard or SPA, webhooks, notifications, GitHub Actions collection scheduling, automatic Git commits, and automatic deployment. No changes to the collector, diff, or their CLI behavior.

## Capabilities

### New Capabilities

- `public-api`: the read-only presentation layer. It resolves the latest validated snapshot and latest change report from the generated project data, validates them against the existing Zod schemas, and serves them over two versioned HTTP endpoints from a thin Cloudflare Worker, without scraping, parsing, normalizing, or computing diffs.

### Modified Capabilities

- None.

## Impact

- New API code under `src/api/` (routes, latest-data index module, and a small data-sync step) and a `data/latest.json` pointer file.
- A new `api:data` package script (and possibly wiring into `build`) so generated data can be bundled and kept in sync.
- New API tests under `tests/` using local fixtures only; no live OpenCode access.
- No new runtime dependencies: Hono, Zod, and the existing tooling are reused. No external storage is introduced.
- No collector, diff, CLI, or schema changes: the API reuses the existing snapshot and change-report schemas and the existing data directories.
