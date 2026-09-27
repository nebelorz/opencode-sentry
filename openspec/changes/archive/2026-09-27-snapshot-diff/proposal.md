## Why

The pipeline can already collect and persist immutable quota snapshots, but nothing compares them, so the project still cannot answer "what changed since the previous check?". This change adds the diff stage: it compares the two most recent snapshots and writes a validated, immutable change report that a later API change can serve.

## What Changes

- Load snapshots from `data/snapshots/`, parse and validate each against the existing Zod snapshot schema, and order them chronologically by their `scrapedAt` timestamp.
- Fail when fewer than two valid snapshots exist, and fail when a loaded snapshot is unreadable, malformed, or schema-invalid. No report is written on failure and no initial diff is invented.
- Compare exactly the latest snapshot (current state) against the immediately preceding snapshot (baseline); never compare against arbitrary historical snapshots.
- Match models by their stable `id`, never by display name.
- Detect `model_added` entries (with the model's complete current `estimatedRequests`), `model_removed` entries (with the model's `previousEstimatedRequests`), and one `quota_changed` entry per quota period whose value changed.
- Compare `fiveHour`, `weekly`, and `monthly` independently, so a single model can produce multiple `quota_changed` entries.
- Handle `unlimited` transitions explicitly: `unlimited -> unlimited` is not a change, `number -> unlimited` and `unlimited -> number` are changes, and any transition involving `unlimited` yields `null` for `change` and `changePercent` (never `NaN` or `Infinity`).
- Compute `change = current - previous` and `changePercent = ((current - previous) / previous) * 100` for numeric changes only, yielding `null` for `changePercent` when the previous value is `0`, and round `changePercent` to two decimal places.
- Add a dedicated Zod change-report schema (not the snapshot schema) with `schemaVersion`, `from` (previous snapshot timestamp), `to` (latest snapshot timestamp), and `changes`, validated before persistence.
- Treat an empty `changes` array as a valid report.
- Persist reports immutably to `data/changes/<timestamp>.json` using the existing filesystem-safe UTC minute-precision snapshot filename convention, derived from the latest snapshot timestamp. Never overwrite an existing report; expose no overwrite or force option.
- Order changes deterministically: `model_added`, then `model_removed`, then `quota_changed`; within each category by model `id`, and within `quota_changed` by period (`fiveHour`, `weekly`, `monthly`).
- Add a minimal `pnpm diff` package script that orchestrates load, select, validate, diff, validate report, persist, and reports failure with a non-zero exit and a stderr message.
- Keep the comparison logic pure and independent of the collector, API, HTTP layer, and filesystem; keep persistence and CLI orchestration separate from it.
- Add offline unit tests for model changes, quota changes, `unlimited` and zero handling, validation, persistence, snapshot selection, and determinism.

Out of scope: API endpoints, Cloudflare deployment, GitHub Actions scheduling, automatic Git commits, notifications, webhooks, historical diff queries, configurable comparison periods, `?since=` parameters, model recommendations, model capability analysis, OpenCode plugins or skills, database or external storage, and any generic diff framework.

## Capabilities

### New Capabilities

- `snapshot-diff`: the diff stage of the pipeline. It loads and validates stored snapshots, selects the latest two by `scrapedAt`, compares models by stable `id`, detects additions, removals, and per-period quota changes (including `unlimited` and zero cases), produces a schema-validated deterministic change report, and persists it immutably under `data/changes/`.

### Modified Capabilities

- None.

## Impact

- New diff code under `src/diff/` and a new change-report schema under `src/schema/`.
- New CLI entry point under `src/cli/` and a `diff` script in `package.json`.
- New output under `data/changes/`.
- New diff and CLI tests under `tests/`, using local snapshot fixtures only.
- No new dependencies: Zod, Node `fs`, and the existing test tooling are reused.
- No API routes, scheduling, deployment, or collector changes.
