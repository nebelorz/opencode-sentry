## Context

See `proposal.md` for motivation. The starting state is an empty repository: only `AGENTS.md`, `EXECUTIVE_SUMMARY.md`, and an OpenSpec root exist. There is no `.git`, no `package.json`, and no toolchain.

Two runtimes are planned for the project: the collector runs on **Node** (GitHub Actions) and the API runs on **Cloudflare Workers** (workerd). The `spec-driven` config at `openspec/config.yaml` sets no extra context or rules.

## Goals / Non-Goals

**Goals:**

- A working install, typecheck, lint, format, test, and Worker build loop on a fresh checkout.
- Git and CI configured so later changes can be validated on every push.
- A foundation small enough that later changes own their own structure and dependencies.

**Non-Goals:**

- Any collector, parser, validation, snapshot, diff, or API route behavior.
- A per-runtime build split, since there is no runtime-specific code yet.
- Cloudflare account, secret, remote, or deployment wiring.
- The scheduled collection workflow, which belongs to the `deployment` change.

## Decisions

**1. Single package, not a monorepo.**
The MVP is one small pipeline. A monorepo adds workspace overhead with no current payoff. Alternative considered: `packages/collector` + `packages/api`. Deferred until a concrete need appears.

**2. ESM throughout.**
`package.json` sets `"type": "module"`. Cloudflare Workers are ESM, and modern Node tooling expects ESM. Alternative considered: CommonJS. Rejected because it would fight the Worker toolchain.

**3. One base TypeScript config for now.**
A single root `tsconfig.json` with `strict: true`, `target: ES2022`, `module: ESNext`, and `moduleResolution: Bundler`, running `noEmit` for typechecking. `@cloudflare/workers-types` is added for Worker globals; the stub entry references them. Alternative considered: separate `tsconfig.collector.json` and `tsconfig.worker.json` from day one. Rejected as premature, and revisited when the collector and API land real code.

**4. Vitest with a real smoke test.**
Vitest is the test runner, configured by `vitest.config.ts`. Instead of relying on `passWithNoTests`, the foundation ships one smoke test that imports the stub Worker and asserts its response, proving the harness and the Worker code are loadable under Node. Alternative considered: no tests plus `passWithNoTests`. Rejected because an empty test command proves nothing in CI.

**5. ESLint flat config plus Prettier.**
`eslint.config.js` uses the flat config with `typescript-eslint`, and `eslint-config-prettier` disables style rules that would conflict with formatting. `prettier.config.js` holds formatting. These names follow `EXECUTIVE_SUMMARY.md` section 14.

**6. Stub Worker, no routes.**
`wrangler.jsonc` declares the Worker name, `main`, and a pinned `compatibility_date`. The entry at `src/api/index.ts` creates a Hono app with no routes. Validation uses a Wrangler dry run (`wrangler deploy --dry-run`) exposed as the `build` script, so the config is exercised without publishing. No deploy script is added.

**7. Only directories that hold real files.**
The foundation creates `src/api/`, `tests/`, and `.github/workflows/`. It does not pre-create `src/collector/`, `src/diff/`, `src/schema/`, or `data/snapshots|changes`, since Git does not track empty directories and `EXECUTIVE_SUMMARY.md` section 14 warns against symmetry-only folders.

```
opencode-sentry/
+-- .github/workflows/ci.yml
+-- src/api/index.ts          (Hono stub, no routes)
+-- tests/smoke.test.ts
+-- package.json
+-- pnpm-lock.yaml
+-- tsconfig.json
+-- vitest.config.ts
+-- eslint.config.js
+-- prettier.config.js
+-- wrangler.jsonc
+-- .gitignore
+-- AGENTS.md
+-- EXECUTIVE_SUMMARY.md
+-- openspec/
```

**8. Git initialized here, remote not.**
The change runs `git init` with a `main` default branch and adds `.gitignore` (dependencies, build output, `.wrangler`, `.dev.vars`, coverage, local env files). Creating the GitHub remote and pushing is a manual step outside the change, because CI cannot run until a remote exists.

**9. CI is validation only.**
`.github/workflows/ci.yml` runs on `push` and `pull_request`: checkout, install pnpm, install Node LTS, `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`, and `pnpm test`. No collect, publish, or deploy step. pnpm and Node versions are pinned (`packageManager` and `engines`).

**10. Package name.**
The package is named `opencode-sentry` to match the repository and marked `private: true`. `EXECUTIVE_SUMMARY.md` section 14 uses `opencode-quota-watch`; the repository name wins. This can change if the repository is renamed.

**11. Dependencies stay minimal.**
Runtime: `hono`. Dev: `typescript`, `vitest`, `eslint`, `typescript-eslint`, `eslint-config-prettier`, `prettier`, `wrangler`, `@cloudflare/workers-types`, `@types/node`. Zod and Cheerio are deliberately absent; they belong to the scraper change.

## Risks / Trade-offs

- Single tsconfig mixing Node and workerd globals can leak types ([risk]) -> keep the stub minimal and split configs when real runtime code lands.
- `wrangler deploy --dry-run` can drift with new Wrangler versions or a stale compatibility date ([risk]) -> pin `compatibility_date`, keep Wrangler in the lockfile, and treat a build failure as a real signal.
- Node and pnpm version drift across machines and CI ([risk]) -> pin via `engines` and `packageManager`, install the pinned pnpm in CI.
- CI cannot run until the GitHub remote exists ([risk]) -> `git init` is in scope; creating and pushing the remote is a documented manual step.
- Adding Worker dependencies before Worker routes exist could look premature ([trade-off]) -> accepted, because validating `wrangler.jsonc` and the build now de-risks the later API change.

## Migration Plan

There is no existing code to migrate. Apply the tasks in order on a clean checkout. Rollback consists of discarding the change, since it introduces no production behavior and no data.

## Open Questions

- When should the single tsconfig be split into collector and Worker configs? Safe to decide when the collector or API change starts.
- Is the repository expected to be renamed from `opencode-sentry` to match the summary's `opencode-quota-watch`? Does not affect specs or tasks.
- Should dependency update automation (Dependabot or Renovate) be added later? Out of scope for this change.
