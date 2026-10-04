## 1. Pointer command

- [x] 1.1 Rename `src/cli/api-data.ts` to `src/cli/latest.ts`; remove the `dataModulePath` option, `renderDataModule`, and `importPath` helpers so it writes only `data/latest.json`; rename exported functions to `syncLatest`/`runLatest`; verify it still selects the newest snapshot and change report and validates both with the existing schemas
- [x] 1.2 Rename `tests/cli/api-data.test.ts` to `tests/cli/latest.test.ts`; update imports and assertions to cover only the pointer (newest selection, missing directory, malformed JSON, invalid schema) and drop `dataModulePath` assertions
- [x] 1.3 Move `tests/fixtures/api/snapshot.valid.json` and `tests/fixtures/api/change-report.valid.json` to `tests/fixtures/latest/`; update fixtures imports; verify no remaining references to `tests/fixtures/api/`

## 2. Remove Worker and API

- [x] 2.1 Delete `src/api/index.ts` and `src/api/data.ts` (and the `src/api/` directory); verify no source imports `src/api`
- [x] 2.2 Delete `tests/api/index.test.ts` and `tests/smoke.test.ts`; verify the test suite no longer references the Worker
- [x] 2.3 Delete `tests/fixtures/api/` (including the invalid fixtures) after moving the valid ones
- [x] 2.4 Delete `wrangler.jsonc`
- [x] 2.5 Remove `hono` from dependencies and `wrangler` and `@cloudflare/workers-types` from devDependencies; remove the `build` and `deploy` scripts and rename `api:data` to `latest` in `package.json`

## 3. Tooling cleanup

- [x] 3.1 Remove `"@cloudflare/workers-types"` from `tsconfig.json` `types`
- [x] 3.2 Remove the `.wrangler/**` ignore from `eslint.config.js`
- [x] 3.3 Remove `.wrangler/` and `.dev.vars` from `.gitignore`
- [x] 3.4 Remove the `workerd` entry from `pnpm-workspace.yaml` `allowBuilds`, keeping `esbuild`

## 4. Documentation and specs

- [x] 4.1 Update `EXECUTIVE_SUMMARY.md`: remove the Cloudflare Worker, public API, and Wrangler references from the MVP, architecture diagrams, stack table, and repository structure; make committed JSON over raw Git the integration interface; note the future endpoint possibility remains available via Git
- [x] 4.2 Verify the main specs are only updated through this change's deltas (`public-api` retired, `project-scaffolding` Worker requirement removed, `latest-pointer` added)

## 5. Verification

- [x] 5.1 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` locally and verify they exit 0
- [x] 5.2 Run `pnpm latest` against the existing `data/` and verify `data/latest.json` is regenerated with the newest snapshot and change report and that no `src/api/data.ts` is written
- [x] 5.3 Verify no file references `wrangler`, `cloudflare`, `workers-types`, `hono`, `ExportedHandler`, or `api:data` outside `node_modules`, Git history, and OpenSpec archives
