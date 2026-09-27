## 1. Latest-data resolution

- [x] 1.1 Implement `src/cli/api-data.ts` exporting `runApiData(options?)` that selects the newest snapshot from `data/snapshots/` and the newest change report from `data/changes/` by filename, validates both against the existing `snapshotSchema` and `changeReportSchema`, writes `data/latest.json` (the relative filenames), and rewrites `src/api/data.ts` as a static-import index re-exporting `latestSnapshot` and `latestChangeReport`; fail with a non-zero result on empty/missing/unreadable/malformed/invalid input; verify `pnpm typecheck` and `pnpm lint` exit 0
- [x] 1.2 Add `"api:data": "node src/cli/api-data.ts"` to `package.json` scripts and verify the script maps to the entry module
- [x] 1.3 Run `pnpm api:data` against the existing `data/` to produce a committed `data/latest.json` and `src/api/data.ts`; if no change report exists yet, first run `pnpm diff` (or seed `data/changes/` from the two existing snapshots) so the index can import a valid report; verify both files exist and `pnpm typecheck` still exits 0

## 2. API routes

- [x] 2.1 Rewrite `src/api/index.ts` to export `createApp(data = DEFAULT_DATA)` with `GET /api/v1/current` returning the snapshot validated by `snapshotSchema.safeParse` (`200` on success, `503` when `snapshot` is `undefined`, `500` when invalid), and `GET /api/v1/changes` returning the change report validated by `changeReportSchema.safeParse` (same status mapping); verify `pnpm typecheck` and `pnpm lint` exit 0
- [x] 2.2 Set `Cache-Control: public, max-age=3600` on the two success responses only, and verify the header is absent on error responses
- [x] 2.3 Add `GET /health` returning `200 { "status": "ok" }` outside `/api/v1`, and preserve the existing default `{ fetch }` export so `wrangler.jsonc` and the smoke test keep working; verify the existing `tests/smoke.test.ts` still passes
- [x] 2.4 Verify the API module graph performs no `fetch` to the OpenCode source and imports no collector or diff module, satisfying the no-scraping/no-diff requirement; verify `pnpm typecheck` exits 0

## 3. API tests

- [x] 3.1 Add fixtures under `tests/fixtures/api/` (a valid snapshot, a valid change report, an invalid snapshot, and an invalid change report) and `tests/api/index.test.ts` using `createApp({ snapshot, changes })` with Hono's `app.request()` to assert `GET /api/v1/current` and `GET /api/v1/changes` return `200` with valid bodies; verify `pnpm test` passes offline
- [x] 3.2 Extend `tests/api/index.test.ts` to assert missing data returns `503`, invalid data returns `500`, error bodies match `{ "error": string }` with no filesystem paths or stack traces, success responses include `Cache-Control`, and `/health` returns `200`; verify `pnpm test` passes offline
- [x] 3.3 Add `tests/cli/api-data.test.ts` running `runApiData` against temporary directories to assert it selects the newest file, writes `latest.json` and a valid `data.ts`, and returns non-zero on empty, missing, malformed, or schema-invalid input; verify `pnpm test` passes offline

## 4. Final verification

- [x] 4.1 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` and verify all exit 0 with no network access
- [x] 4.2 Verify scope: the Worker performs no scraping, parsing, normalization, snapshot generation, or diff logic; the existing snapshot and change-report schemas are reused and not duplicated; no new runtime dependency was added; no external storage (R2/KV/D1) or database was introduced; and the collector, diff, and their CLIs are unchanged
