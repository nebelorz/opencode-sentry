## Context

See `proposal.md` for motivation and `specs/snapshot-diff/spec.md` for the behavior contract.

The collector already defines the snapshot shape and its persistence convention. `src/schema/snapshot.ts` exports `snapshotSchema` plus inferred types (`Snapshot`, `SnapshotModel`, `QuotaValue`), where a quota value is a non-negative integer or the literal `"unlimited"`. `src/collector/persist.ts` derives filenames with `snapshotFilename(scrapedAt)` (UTC, minute precision, `:` replaced by `-`, `.json`) and writes with an exclusive-create flag (`wx`). `src/cli/collect.ts` shows the established CLI pattern: a thin, injectable `runCollect(collect, io)` returning an exit code, plus an `import.meta.url === pathToFileURL(process.argv[1]).href` main-module guard. The previous change (`collector-cli`) added explicit `.ts` import specifiers and `allowImportingTsExtensions`, so Node runs TypeScript directly with no build step.

Constraints from `AGENTS.md` and the request: keep modules small and single-purpose, keep the diff independent from collector/API/HTTP, keep the comparison pure where practical, never publish partial data, never overwrite existing files, prefer existing tooling, and introduce no repository/service/factory/DI abstraction.

Two ambiguities were resolved with the user before writing: change reports use the existing snapshot filename convention (minute precision, e.g. `2026-09-27T12-15.json`), and undefined `change`/`changePercent` values are represented as JSON `null`.

## Goals / Non-Goals

**Goals:**

- A pure comparison over two validated snapshots that returns a deterministic change report.
- Reuse of the existing snapshot schema; a new dedicated change-report schema.
- Immutable, no-overwrite persistence under `data/changes/` following the snapshot filename convention.
- A `pnpm diff` entry point mirroring `pnpm collect`.
- Offline, deterministic tests using fixtures and temp directories.

**Non-Goals:**

- No CLI argument parsing, configuration files, or command framework.
- No API routes, scheduling, deployment, notifications, webhooks, plugins, or skills.
- No configurable comparison windows, historical queries, or `?since=` style parameters.
- No changes to collector behavior, snapshot semantics, or persistence format.
- No shared "timestamp utility" refactor of the existing collector (see Decisions).

## Decisions

**1. Module layout mirrors the collector: pure core, separate I/O and CLI.**

```text
src/schema/change.ts    Change-report Zod schema + inferred types
src/diff/compare.ts     compareSnapshots(previous, latest): Change[]   (pure)
src/diff/load.ts        loadSnapshots(dir), selectLatestTwo(snapshots) (I/O + selection)
src/diff/persist.ts     reportFilename(to), persistChangeReport(report, dir) (I/O)
src/diff/index.ts       runDiffPipeline(options): Promise<string>      (orchestration)
src/cli/diff.ts         runDiff(pipeline, io): Promise<number>         (entry point)
```

The comparison logic (`compare.ts`) reads and writes nothing. Loading, selection, persistence, and orchestration stay out of it, satisfying the spec's purity and independence requirements. Alternative considered: a single `src/diff/index.ts` containing everything. Rejected because it mixes pure comparison with filesystem concerns and blocks focused testing of the ordering rules.

**2. Dedicated change-report schema with a discriminated union and nullable numbers.**

```ts
// src/schema/change.ts
const quotaPeriodSchema = z.enum(["fiveHour", "weekly", "monthly"]);
const quotaValueSchema = z.union([z.number().int().nonnegative(), z.literal("unlimited")]);
const modelRefSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
const estimatedRequestsSchema = z.object({
  fiveHour: quotaValueSchema,
  weekly: quotaValueSchema,
  monthly: quotaValueSchema,
});

const changeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("model_added"), model: modelRefSchema, estimatedRequests: estimatedRequestsSchema }),
  z.object({ type: z.literal("model_removed"), model: modelRefSchema, previousEstimatedRequests: estimatedRequestsSchema }),
  z.object({
    type: z.literal("quota_changed"),
    model: modelRefSchema,
    quota: z.object({
      period: quotaPeriodSchema,
      previous: quotaValueSchema,
      current: quotaValueSchema,
      change: z.number().nullable(),
      changePercent: z.number().nullable(),
    }),
  }),
]);

export const changeReportSchema = z.object({
  schemaVersion: z.literal(1),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  changes: z.array(changeSchema),
});
```

The snapshot schema is reused for snapshot validation only; the report gets its own schema as required. Reusing `quotaValueSchema` from `src/schema/snapshot.ts` for report quota values avoids duplicating the `number | "unlimited"` union while still keeping the report schema distinct. Alternative considered: reusing `snapshotSchema` for the report. Rejected explicitly by the spec.

**3. Snapshot loading validates every file and fails fast.**

`loadSnapshots(dir)` reads every `*.json` file, parses JSON, and runs `snapshotSchema.parse`. Any unreadable, unparseable, or schema-invalid file throws a descriptive error naming the file. `selectLatestTwo` sorts the valid snapshots by `Date.parse(scrapedAt)` ascending (tie-break by filename for determinism) and throws when fewer than two exist, with a message stating at least two snapshots are required.

Alternative considered: skip invalid files and compare the two most recent valid ones. Rejected because the project principle is to fail safely on untrusted data rather than silently ignore it; a corrupt file should surface, not hide a gap in history. The strict policy is recorded as a spec requirement. The cost (one corrupt historical file blocks future diffs until removed) is accepted and noted under Risks.

**4. Comparison uses id-keyed maps and emits per-period entries.**

`compareSnapshots` builds `Map<id, model>` for each snapshot, then:

- additions: ids in latest not in previous, sorted by id;
- removals: ids in previous not in latest, sorted by id;
- quota changes: for ids in both, for each period in `fiveHour`, `weekly`, `monthly`, emit an entry when the values differ.

Distinct ids that share a display name remain distinct; the same id with a changed display name is still the same model. For `model_added`/`quota_changed` the `name` comes from the latest snapshot; for `model_removed` it comes from the previous snapshot. The function returns `Change[]` in the required deterministic order (category, then id, then period); it does not depend on map iteration order.

**5. Unlimited and zero handling is explicit and JSON-safe.**

For a numeric-to-numeric change: `change = current - previous`; `changePercent = previous === 0 ? null : Math.round(((current - previous) / previous) * 10000) / 100`. `Math.round` (`Math.round(x * 100) / 100`) after multiplying is the defined two-decimal rounding. For any transition involving `unlimited`: both `change` and `changePercent` are `null`. `unlimited -> unlimited` is filtered out as "no change". `previous`/`current` always carry the real quota values. This guarantees no `NaN`, `Infinity`, or `-Infinity` ever reaches the JSON.

Alternative considered: sentinel strings (`"unlimited"`, `"n/a"`) for `change`. Rejected in favor of `null`, which the Zod schema validates as a nullable number and which is unambiguously JSON-safe.

**6. Report metadata copies snapshot timestamps verbatim.**

`from` is `previous.scrapedAt` and `to` is `latest.scrapedAt`, copied unchanged (no re-serialization), so the report's anchors equal the snapshots it describes.

**7. Persistence reuses the snapshot filename convention without importing the collector.**

`reportFilename(to)` in `src/diff/persist.ts` derives the minute-precision UTC filename the same way `snapshotFilename` does. The pipeline validates the assembled report with `changeReportSchema.parse` and then calls `persistChangeReport`, which `mkdir`s `data/changes` recursively and writes with `flag: "wx"`, so a colliding filename raises `EEXIST` and never overwrites. Reports are derived from the latest snapshot timestamp, so there is exactly one report per transition and re-running is a safe non-zero failure.

Alternative considered: import and reuse `snapshotFilename` from `src/collector/persist.ts`. Rejected to keep the diff independent of the collector; the helper is two lines and duplicating that convention is preferable to a cross-stage dependency or a shared-utility refactor that would touch the previous, already-implemented change.

**8. CLI mirrors `pnpm collect`.**

```ts
// src/cli/diff.ts
import { pathToFileURL } from "node:url";
import { runDiffPipeline, type DiffPipeline } from "../diff/index.ts";

export interface DiffIo { log(message: string): void; error(message: string): void; }

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
```

Add `"diff": "node src/cli/diff.ts"` to `package.json` scripts. Injecting the pipeline and writers is the test seam, exactly as in `collect.ts`. Errors are never swallowed; the message (no stack) goes to stderr; `process.exitCode` is set rather than calling `process.exit()`.

**9. `runDiffPipeline` accepts directory and validation seams defaulting to production.**

```ts
export interface DiffOptions { snapshotsDir?: string; changesDir?: string; }
export async function runDiffPipeline(options: DiffOptions = {}): Promise<string> {
  // defaults: "data/snapshots", "data/changes"
}
```

Tests pass temporary directories. No configuration files, flags, or environment switches are part of the production contract.

## Risks / Trade-offs

- Strict validation of every snapshot file -> one corrupt historical snapshot blocks all future diffs. Mitigation: this is the intended fail-safe behavior; the thrown error names the offending file so it can be repaired or removed.
- `reportFilename` duplicates a two-line convention from the collector -> low risk; covered by a persistence test asserting the exact filename, and selected deliberately over coupling the diff to the collector.
- Minute-precision report filenames mean two different transitions could theoretically map to the same filename if two snapshots shared a timestamp minute -> impossible in practice because snapshot filenames are exclusive-created at minute precision; a collision would surface as a safe `EEXIST` failure, not an overwrite.
- `changePercent` rounding uses `Math.round` (half toward `+Infinity` for exact halves) -> deterministic and documented; exact-half inputs are not expected from integer quota values but behavior is defined if they occur.
- A model renamed while keeping its id reports a `quota_changed` (or no change) using the latest name, not a rename -> acceptable; rename detection is out of scope and the id is the canonical identity.

## Migration Plan

Additive only. No data or existing behavior is migrated. New directories `src/diff/` and `data/changes/`, a new schema file, a new CLI file, one `package.json` script, and new tests and fixtures. No production `data/changes` file is produced by this change itself. Reverting means deleting the new files, the `diff` script, the new tests and fixtures, and any reports written by a real run; snapshots and collector behavior are untouched.
