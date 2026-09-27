## Why

The repository currently holds only planning documents (`AGENTS.md`, `EXECUTIVE_SUMMARY.md`) and an OpenSpec root. There is no package, toolchain, or CI, so no later change (scraper, diff, API, deployment) can be implemented or verified. A minimal foundation is needed first, so every subsequent change starts from a working install, build, test, and lint loop.

## What Changes

- Initialize the repository as a single pnpm + TypeScript package.
- Add TypeScript configuration targeting the Node collector runtime.
- Add Vitest with one smoke test so the test command has something to run.
- Add ESLint (flat config) and Prettier.
- Add Hono and Wrangler dependencies, a `wrangler.jsonc`, and a minimal stub Worker entry that builds. No API routes.
- Initialize Git with a `.gitignore` and a `main` default branch.
- Add a GitHub Actions CI workflow that runs lint, typecheck, and test on push and pull request.
- Create only the directories that hold real files; do not pre-create empty scraper, diff, or data trees.

Out of scope for this change: scraper, parser, Zod validation, snapshot generation, diff logic, API routes, the scheduled collection workflow, Cloudflare deployment, and OpenCode integration.

## Capabilities

### New Capabilities

- `project-scaffolding`: the verified foundation of the project. A single pnpm + TypeScript package that installs, typechecks, lints, formats, tests, and builds a stub Cloudflare Worker, with Git and CI configured.

### Modified Capabilities

- None.

## Impact

- New project files: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, a Prettier config, `wrangler.jsonc`, a stub Worker entry, a smoke test, `.gitignore`, and `.github/workflows/ci.yml`. Exact names and formats are settled in `design.md`.
- Tooling: pnpm, Node, Vitest, ESLint, Prettier, Hono, Wrangler.
- No runtime behavior, data, or API changes.
