## Why

The Hono Worker and its Cloudflare deployment path were never published. Consumption is now the committed JSON over raw GitHub plus a global OpenCode skill, which makes the Worker, `wrangler.jsonc`, the Cloudflare tooling, and `src/api/data.ts` dead runtime code. `data/latest.json` is still needed as the pointer the skill reads, but it must stop depending on the API module generation.

## What Changes

- **BREAKING** Remove the `public-api` capability and its runtime: delete `src/api/` (Hono Worker), `wrangler.jsonc`, the Worker tests, and the API fixtures.
- Remove the `hono`, `wrangler`, and `@cloudflare/workers-types` dependencies and the `build` and `deploy` scripts.
- Replace the `api:data` CLI with a `latest` CLI that writes only `data/latest.json`, reusing the existing snapshot and change-report validation.
- Update `tsconfig.json`, `eslint.config.js`, `.gitignore`, and `pnpm-workspace.yaml` to drop the Cloudflare and Worker leftovers.
- Update `EXECUTIVE_SUMMARY.md` so the integration interface is Git/raw and the Worker is no longer part of the MVP.
- Do not change the collector, the diff, the schemas, or any data format.

## Capabilities

### New Capabilities

- `latest-pointer`: a generated `data/latest.json` pointer that identifies the newest snapshot and the newest change report, produced by a thin CLI command.

### Modified Capabilities

- `public-api`: remove the capability entirely; no HTTP API is implemented or deployed.
- `project-scaffolding`: remove the "Stub Cloudflare Worker builds" requirement, because the Worker no longer exists.

## Impact

- Delete `src/api/index.ts`, `src/api/data.ts`, `tests/api/`, `tests/smoke.test.ts`, and `wrangler.jsonc`.
- Rename `src/cli/api-data.ts` to `src/cli/latest.ts`, rename the `api:data` script to `latest`, and rename `tests/cli/api-data.test.ts` to `tests/cli/latest.test.ts`.
- `package.json` loses `hono`, `wrangler`, `@cloudflare/workers-types`, `build`, and `deploy`.
- `tsconfig.json`, `eslint.config.js`, `.gitignore`, and `pnpm-workspace.yaml` lose Worker-specific entries.
- `EXECUTIVE_SUMMARY.md` is updated.
- `data/latest.json` and all historical data are preserved; no format changes.
