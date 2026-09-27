## Context

See `proposal.md` for motivation. The pipeline already exists as a library: `src/collector/index.ts` exports `collectQuotaSnapshot(options)` and wires fetch -> parse Estimated Requests -> parse Endpoints -> normalize -> match -> build/validate -> persist. Its options (`fetchImpl`, `now`, `url`, `outputDir`) exist only as test seams and already default to production behavior (global `fetch`, current time, the documented URL, `data/snapshots`). Persistence is immutable via Node's exclusive-create flag (`flag: "wx"`), so a colliding filename throws `EEXIST` instead of overwriting.

Constraints from `AGENTS.md` and the request: keep the change extremely small, do not duplicate collection logic, prefer existing tooling over new dependencies, never publish partial data, and never overwrite existing snapshots. The entry point must run outside the test suite and must be exercised by offline tests.

One concrete blocker shapes the design: the collector's relative imports are extensionless (`import ... from "./fetch"`). Node's built-in TypeScript type stripping does not perform extension resolution for ESM, so `node src/collector/index.ts` fails with `ERR_MODULE_NOT_FOUND` (verified on Node 24.20). The CLI must therefore make the module graph resolvable by Node without a build step or a new dependency.

## Goals / Non-Goals

**Goals:**

- One `pnpm collect` command that runs the real collector against the live documentation and persists a real snapshot.
- An entry module with no collection business logic: it invokes the collector, reports the result, and maps failures to a non-zero exit status.
- Offline, deterministic tests for the entry point, including failure, no-overwrite, and surfaced-error behavior.
- Zero new dependencies and no build step.

**Non-Goals:**

- No CLI argument parsing, configuration files, or command framework.
- No diff, change report, scheduling, deployment, API route, plugin, skill, database, or recommendation logic.
- No changes to collector logic, parsing, matching, validation, or persistence semantics.
- No retry/backoff, logging framework, or structured output.

## Decisions

**1. Entry module at `src/cli/collect.ts`; keep `src/collector/` pure pipeline.**

The entry point sits above the collector, matching the request's design goal diagram. Putting it in `src/collector/` would mix invocation concerns into the pipeline directory. Alternative considered: `src/collector/cli.ts`. Rejected because the collector directory is deliberately one concern per module and must stay independent of how it is invoked.

**2. Run TypeScript directly on Node via built-in type stripping, and make the module graph resolvable.**

- Set the package script to `"collect": "node src/cli/collect.ts"`.
- Add explicit `.ts` extensions to the relative imports in `src/collector/` and `src/schema/`, and to the new entry module's import of the collector. This is an import-specifier change only, not a collector logic change.
- Add `"allowImportingTsExtensions": true` to `tsconfig.json`. It is permitted because `noEmit` is already true, and it lets `pnpm typecheck` accept the `.ts` specifiers.
- Raise `engines.node` from `>=22.0.0` to `>=22.18.0`, the first 22.x release where type stripping is enabled by default, so `node <file>.ts` runs without an experimental flag. The CI workflow uses `lts/*` and the local runtime is Node 24, which already has type stripping enabled (`process.features.typescript === "strip"`).

Alternative considered: add `tsx` as a dev dependency. Rejected to honor "prefer existing tooling over adding dependencies" and the explicit no-new-dependency rule. Alternative considered: compile with `tsc` to `dist/` and run the emitted JavaScript. Rejected because it adds a build step, a new output tree, and ESM extension-rewriting complexity, and the request forbids unnecessary tooling. Alternative considered: pass `--experimental-strip-types` in the script. Rejected in favor of an accurate engines floor and a clean script; the flag is a no-op on Node 24 anyway.

**3. Thin, injectable `runCollect` seam; execute only when run as the main module.**

```ts
// src/cli/collect.ts
import { pathToFileURL } from "node:url";
import { collectQuotaSnapshot } from "../collector/index.ts";

export interface CollectIo {
  log(message: string): void;
  error(message: string): void;
}

export async function runCollect(
  collect: () => Promise<string> = collectQuotaSnapshot,
  io: CollectIo = console,
): Promise<number> {
  try {
    const path = await collect();
    io.log(`Snapshot created: ${path}`);
    return 0;
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCollect();
}
```

Injecting the collector function and the output writers is the test seam, mirroring the collector's own plain-options seam (no DI container, no mocks of global `fetch`). Tests call `runCollect(fakeCollect, fakeIo)` and, for the no-overwrite case, call the real collector with an injected offline `fetchImpl` and a temp `outputDir`, so persistence is exercised for real. The `import.meta.url` guard keeps importing the module from a test from triggering a live collection.

Alternative considered: spawn a child process running the CLI and assert on its exit code. Rejected because it would need either network access or a test-only argument/environment channel, which the spec forbids for the production contract. Alternative considered: always execute and mock the collector module with `vi.mock`. Rejected in favor of an explicit, small seam that also exercises the real error mapping.

**4. Error handling: catch, report to stderr, return code 1; never call `process.exit()`.**

`runCollect` returns an exit code and the executable assigns it to `process.exitCode`, allowing the process to finish naturally. It prints only the error message (no stack) to stderr so the failure is visible without noise. Errors are never swallowed: every thrown collector error becomes a non-zero exit and a stderr line. Alternative considered: let the top-level `await` reject and rely on Node's default uncaught-exception handling. Rejected because it prints a stack trace, bypasses the testable seam, and does not give the concise message the request asks for.

**5. Success output identifies the snapshot path.**

The collector already returns the written path (`persist.ts` returns it), so the entry point prints `Snapshot created: <path>`. Exact wording is not part of the contract, only that the generated file is identified.

**6. Tests live at `tests/cli/collect.test.ts` and stay offline.**

Coverage: success returns 0 and prints the path; collector failure returns non-zero and writes the message to stderr; running the real collector twice into the same temp `outputDir` yields a non-zero second run with `EEXIST` surfaced and the first file byte-for-byte unchanged; a thrown non-`Error` value is still surfaced. The existing `tests/collector/live.integration.test.ts` gate is untouched, and entry point tests never call the live source.

## Risks / Trade-offs

- Node version floor (`>=22.18.0`) excludes older Node 22 patch releases -> the floor matches the feature actually required; the project is private and CI uses `lts/*`.
- Adding `.ts` to relative imports touches existing collector and schema files -> the change is mechanical (specifiers only) and is the concrete fix for the entry point's `ERR_MODULE_NOT_FOUND`; `pnpm typecheck`, `pnpm lint`, and `pnpm test` must all still pass.
- `verbatimModuleSyntax` plus explicit `.ts` specifiers could trip a lint rule or `allowImportingTsExtensions` could conflict with the current `tsconfig` -> verified by running typecheck and lint as explicit tasks; `noEmit` already satisfies the option's precondition.
- The `import.meta.url === pathToFileURL(process.argv[1]).href` main-module check is slightly noisy -> it is a standard, dependency-free pattern and is the smallest way to keep the module importable by tests.
- Two real runs within the same UTC minute collide on the timestamp filename -> inherited, accepted behavior; the exclusive write turns the second run into a safe non-zero failure rather than an overwrite.
- A transient live-source fetch failure exits non-zero with no snapshot -> intended fail-safe behavior; retry/backoff remains out of scope.

## Migration Plan

Additive only. No data or existing behavior is migrated. Reverting means deleting `src/cli/`, the `collect` script, the entry point tests, and the import-specifier and `tsconfig`/`engines` changes; any `data/snapshots/` files written by a real run can be discarded, since nothing consumes them yet. No snapshot is produced by this change itself.

## Open Questions

- Should `pnpm collect` add retry/backoff for transient fetch failures? Deferrable; the fail-safe path is correct either way and scheduling belongs to a later change.
- Should the success message format be stabilized (for example, for machine parsing by a future workflow)? Deferrable; the request explicitly treats the wording as unimportant.
