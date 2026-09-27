## 1. Change-report schema

- [x] 1.1 Implement `src/schema/change.ts` exporting `changeReportSchema` (with `schemaVersion: 1`, ISO `from`/`to`, and a `changes` array of a discriminated union on `type` for `model_added`, `model_removed`, and `quota_changed`), plus inferred `ChangeReport` and `Change` types; reuse `quotaValueSchema` from `src/schema/snapshot.ts` for quota values and make `change`/`changePercent` nullable numbers; verify `pnpm typecheck` exits 0
- [x] 1.2 Add `tests/diff/schema.test.ts` asserting the schema accepts a report containing each change type, accepts an empty `changes` array, accepts `null` `change`/`changePercent` with an `unlimited` value, and rejects an unknown change type, an unexpected `schemaVersion`, and a non-null `changePercent` paired with a non-number; verify `pnpm test` passes

## 2. Comparison logic

- [x] 2.1 Implement `src/diff/compare.ts` exporting `compareSnapshots(previous, latest): Change[]` that builds id-keyed maps, detects additions and removals by stable `id`, compares `fiveHour`, `weekly`, and `monthly` independently, and returns changes ordered by category (`model_added`, `model_removed`, `quota_changed`), then by model `id`, then by quota period; verify `pnpm typecheck` and `pnpm lint` exit 0
- [x] 2.2 Implement numeric change computation (`change = current - previous`, `changePercent = ((current - previous) / previous) * 100` rounded to two decimals) with `changePercent` equal to `null` when the previous value is `0`; verify `tests/diff/compare.test.ts` covers five-hour, weekly, and monthly changes, multiple periods for one model, multiple models changed, and the zero cases with no `NaN` or `Infinity`
- [x] 2.3 Implement `unlimited` handling so `unlimited -> unlimited` is not a change, `number -> unlimited` and `unlimited -> number` are changes, and any transition involving `unlimited` yields `null` for both `change` and `changePercent` while `previous`/`current` retain the actual values; verify `tests/diff/compare.test.ts` covers all three transitions and asserts no non-finite values
- [x] 2.4 Add comparison tests covering no changes, a single model added, a single model removed, multiple models added, and multiple models removed, including that models present in both are not reported as added or removed and that matching is by `id` not name; verify `pnpm test` passes

## 3. Snapshot loading and selection

- [x] 3.1 Implement `src/diff/load.ts` exporting `loadSnapshots(dir)` (read every `*.json` file, parse JSON, validate with `snapshotSchema`, and throw a file-naming error on unreadable, unparseable, or schema-invalid input) and `selectLatestTwo(snapshots)` (order by `scrapedAt` ascending with a filename tie-break, return the last two, and throw a "at least two snapshots are required" error when fewer than two exist); verify `pnpm typecheck` exits 0
- [x] 3.2 Add snapshot fixtures under `tests/fixtures/snapshots/` (at least three chronologically distinct valid snapshots plus one invalid snapshot) and `tests/diff/load.test.ts` covering fewer than two snapshots, exactly two snapshots, more than two snapshots selecting the latest two, and rejection of an invalid snapshot; verify `pnpm test` passes offline

## 4. Report persistence

- [x] 4.1 Implement `src/diff/persist.ts` exporting `reportFilename(to)` using the snapshot convention (UTC, minute precision, `:` replaced by `-`, `.json`) and `persistChangeReport(report, dir)` that creates the directory recursively and writes JSON with the exclusive-create flag; verify `pnpm typecheck` exits 0
- [x] 4.2 Add `tests/diff/persist.test.ts` covering the exact derived filename, writing a new report, failing with `EEXIST` without altering an existing report, leaving no partial report after a rejected write, and persisting an empty change report successfully; verify `pnpm test` passes

## 5. Orchestration

- [x] 5.1 Implement `src/diff/index.ts` exporting `runDiffPipeline(options?)` with `snapshotsDir` defaulting to `data/snapshots` and `changesDir` defaulting to `data/changes`; it loads and validates snapshots, selects the latest two, calls `compareSnapshots`, assembles the report with `from`/`to` from the snapshot timestamps, validates it with `changeReportSchema.parse`, and persists it immutably, returning the written path; verify `pnpm typecheck` and `pnpm lint` exit 0
- [x] 5.2 Add `tests/diff/index.test.ts` running the pipeline against temporary directories to assert a validated report is written with the latest snapshot-derived filename, `from`/`to` equal the snapshots' `scrapedAt`, the `changes` ordering is deterministic across repeated runs, an empty report is persisted, and a failure leaves no report behind; verify `pnpm test` passes offline

## 6. CLI

- [x] 6.1 Implement `src/cli/diff.ts` exporting `runDiff(diff = runDiffPipeline, io = console)` that returns `0` and logs the report path on success, returns `1` and writes the error message (never swallowed, no stack) to stderr on failure, plus an `import.meta.url === pathToFileURL(process.argv[1]).href` guard setting `process.exitCode`; verify `pnpm typecheck` and `pnpm lint` exit 0
- [x] 6.2 Add `"diff": "node src/cli/diff.ts"` to `package.json` scripts; verify the script is defined and maps to the entry module
- [x] 6.3 Add `tests/cli/diff.test.ts` using injected fake pipeline and writer functions to assert success returns `0` and prints the path, a thrown `Error` returns non-zero and writes its message to stderr, and a thrown non-`Error` value is still surfaced; verify `pnpm test` passes with no network access

## 7. Determinism verification

- [x] 7.1 Add a test asserting that two identical comparisons produce equivalent reports with the same ordering, and that a report mixing additions, removals, and quota changes orders categories as `model_added`, then `model_removed`, then `quota_changed`, with ids and periods ordered as specified; verify `pnpm test` passes

## 8. Final verification

- [x] 8.1 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` and verify all exit 0 with no network access
- [x] 8.2 Verify scope: `src/diff/compare.ts` performs no file or network I/O; the diff contains no collector, scraping, HTTP, API, or scheduling logic and no repository/service/factory/DI abstraction; the snapshot schema is reused rather than duplicated; no `package.json` dependencies were added; and no production `data/changes/` report is produced by this change itself

