## Why

The full collection pipeline already exists as a library (`collectQuotaSnapshot` in `src/collector/index.ts`), but nothing runs it outside the test suite. As a result the real source can only be collected by a test, and a real snapshot has never been persisted to `data/snapshots/`. A minimal runnable entry point is needed so the complete pipeline can be executed on demand against the live documentation.

## What Changes

- Add a `collect` package script so `pnpm collect` runs the collector end to end against the official OpenCode documentation.
- Add a small CLI entry module that orchestrates the existing collector unchanged (fetch -> parse Estimated Requests and Endpoints -> normalize -> match -> validate -> persist). It contains no collection business logic of its own.
- On success, persist a validated snapshot under `data/snapshots/` using the existing filesystem-safe UTC timestamp filename and print a concise message naming the generated file; exit successfully.
- On any failure, write the error to stderr, exit with a non-zero code, leave no partial or invalid snapshot, and leave existing snapshots untouched.
- Rely on the collector's existing production behavior and defaults (live source URL, current UTC time, `data/snapshots/`). Do not expose `LIVE_SOURCE` or any other test or configuration option through the CLI, and do not add CLI arguments, configuration files, or force/overwrite flags.
- Keep the CLI runnable on Node without a build step or a new dependency: add `.ts` extensions to the relative imports in `src/collector/` and `src/schema/` and enable `allowImportingTsExtensions`. This changes import specifiers only, not collector logic.
- Add offline tests for the entry point covering successful collection, non-zero exit on collector failure, no overwrite of an existing snapshot, and surfaced errors. The existing `LIVE_SOURCE=1` integration test stays opt-in and is unchanged.

Out of scope: diff generation, change reports, GitHub Actions scheduling, automatic Git commits, Cloudflare deployment, API routes, OpenCode plugins or skills, a full CLI, CLI arguments, configuration files, database storage, and model recommendations. This change is only the executable entry point for the collector.

## Capabilities

### New Capabilities

- `collector-cli`: the executable entry point that runs the existing collection pipeline on demand, reports success with the generated snapshot path, fails loudly with a non-zero exit code, and preserves the collector's immutable, no-overwrite persistence guarantees.

### Modified Capabilities

- None.

## Impact

- New CLI entry module and a new `collect` script in `package.json`.
- Import-specifier changes in `src/collector/` and `src/schema/`, plus `allowImportingTsExtensions` in `tsconfig.json` and a `node`-compatible TypeScript execution path. No collector logic changes.
- New tests under `tests/` for the entry point.
- New `data/snapshots/` output directory, created only on a successful run; it is not pre-created or committed by this change.
- No new dependencies.
