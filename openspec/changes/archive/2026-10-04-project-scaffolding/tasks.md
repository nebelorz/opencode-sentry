## 1. Repository and package skeleton

- [x] 1.1 Initialize Git with `git init -b main` and verify `git symbolic-ref --short HEAD` prints `main`
- [x] 1.2 Add `.gitignore` covering `node_modules/`, `dist/`, `.wrangler/`, `.dev.vars`, `coverage/`, and local env files, and verify `git status` does not list installed dependencies or build output
- [x] 1.3 Create `package.json` named `opencode-sentry`, `private: true`, `"type": "module"`, a pinned `packageManager`, a Node LTS `engines` range, and the scripts `lint`, `format`, `format:check`, `typecheck`, `test`, and `build`; verify `pnpm install` succeeds and writes `pnpm-lock.yaml`

## 2. TypeScript, ESLint, and Prettier

- [x] 2.1 Add `typescript`, `@types/node`, and `@cloudflare/workers-types`, then create `tsconfig.json` with `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, and `noEmit`; verify `pnpm typecheck` exits 0
- [x] 2.2 Add `eslint`, `typescript-eslint`, and `eslint-config-prettier`, create the flat `eslint.config.js`, and verify `pnpm lint` exits 0 on the current sources
- [x] 2.3 Add `prettier`, create `prettier.config.js`, and verify `pnpm format:check` exits 0 after running `pnpm format`

## 3. Stub Cloudflare Worker

- [x] 3.1 Add `hono` and `wrangler`, create `wrangler.jsonc` with the Worker name, `main` pointing to `src/api/index.ts`, and a pinned `compatibility_date`; verify the file parses as JSONC
- [x] 3.2 Create the stub entry `src/api/index.ts` with a Hono app and no routes; verify `pnpm build` (`wrangler deploy --dry-run`) completes without publishing

## 4. Vitest smoke test

- [x] 4.1 Add `vitest` and `vitest.config.ts`; verify `pnpm test` starts Vitest with the config loaded
- [x] 4.2 Add `tests/smoke.test.ts` that imports the stub Worker and asserts its response; verify `pnpm test` passes and fails when the assertion is intentionally broken

## 5. Continuous integration

- [x] 5.1 Add `.github/workflows/ci.yml` triggered on `push` and `pull_request` that installs the pinned pnpm and Node LTS, runs `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`, and `pnpm test`; verify the YAML is valid and contains no publish, collect, or deploy step

## 6. Final verification

- [x] 6.1 On a clean checkout, run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` in sequence and verify every command exits 0
- [x] 6.2 Verify no scraper, parser, Zod validation, snapshot, diff, API route, scheduled collection, or deployment code exists
