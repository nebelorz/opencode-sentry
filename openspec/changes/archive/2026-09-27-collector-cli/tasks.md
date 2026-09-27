## 1. Node resolution and tooling

- [x] 1.1 Add explicit `.ts` extensions to the relative imports in `src/collector/index.ts`, `src/collector/match.ts`, `src/collector/snapshot.ts`, `src/collector/persist.ts`, `src/collector/normalize.ts`, and `src/schema/snapshot.ts` (import specifiers only, no logic changes); verify `node src/collector/index.ts` exits with no `ERR_MODULE_NOT_FOUND`
- [x] 1.2 Add `"allowImportingTsExtensions": true` to `tsconfig.json` and raise `engines.node` in `package.json` to `>=22.18.0`; verify `pnpm typecheck` exits 0
- [x] 1.3 Run `pnpm lint` and `pnpm test` after the import changes and verify both still exit 0 offline (Vite resolves the explicit `.ts` specifiers)

## 2. CLI entry point

- [x] 2.1 Implement `src/cli/collect.ts` exporting `runCollect(collect = collectQuotaSnapshot, io = console)` that returns `0` and logs `Snapshot created: <path>` on success, and returns `1` and writes the error message (never swallowed, no stack) to stderr on failure, plus an `import.meta.url === pathToFileURL(process.argv[1]).href` guard that sets `process.exitCode` only when run as the main module; verify `pnpm typecheck` and `pnpm lint` exit 0
- [x] 2.2 Add `"collect": "node src/cli/collect.ts"` to the `package.json` scripts; verify the script is defined and maps to the entry module, then, if network is available, run `pnpm collect` once and confirm a validated snapshot is written under `data/snapshots/` and the success message names the file (this run is separate from the test suite)

## 3. Entry point tests

- [x] 3.1 Add `tests/cli/collect.test.ts` using injected fake collector and writer functions to assert: success returns `0` and prints the path; a thrown `Error` returns non-zero and writes its message to stderr; a thrown non-`Error` value is still surfaced; verify `pnpm test` passes with no network access
- [x] 3.2 Add a no-overwrite test that calls `runCollect` with a closure invoking the real collector using an injected fixture `fetchImpl` (`tests/fixtures/opencode-go.valid.html`), a fixed `now`, and a temporary `outputDir`, runs it twice, and asserts the second run is non-zero, surfaces `EEXIST`, leaves exactly one file, and leaves that file unchanged; verify `pnpm test` passes offline
- [x] 3.3 Verify the normal suite never contacts the live source: `pnpm test` passes with `LIVE_SOURCE` unset and `tests/collector/live.integration.test.ts` is reported as skipped

## 4. Final verification

- [x] 4.1 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` and verify all exit 0 offline
- [x] 4.2 Verify the change scope: `src/cli/collect.ts` contains no fetching, parsing, normalization, matching, validation, or persistence logic; no CLI arguments, configuration files, or overwrite/force option were added; collector logic and persistence semantics are unchanged; and `dependencies` in `package.json` are unchanged (no new dependency)
