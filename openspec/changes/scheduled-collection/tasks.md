> Resume guide for a future session: sections 1 and 2 are local code work. Section 3 and section 4.3-4.5 depend on the maintainer pushing `main` and are deferred. If apply is run before that setup, do not attempt the deferred tasks as code work; guide the maintainer first:
> 1. Publish the branch: `git push -u origin main` (origin is `https://github.com/nebelorz/opencode-sentry.git`), so the `schedule` trigger can fire.
> 2. Leave `main` unprotected or grant `github-actions[bot]` a bypass so generated-data commits can be pushed.
> 3. After setup, run a `workflow_dispatch` run and verify the remote tasks.

## 1. Production workflow

- [x] 1.1 Create `.github/workflows/collect.yml` with `name: Collect` and triggers `schedule` (`cron: "15 0 * * *"` and `cron: "15 12 * * *"`) and `workflow_dispatch`; verify the file is valid YAML and the two crons correspond to `00:15` and `12:15` UTC
- [x] 1.2 Add `permissions: contents: write` and `concurrency: { group: production-collect, cancel-in-progress: false }` at the workflow level
- [x] 1.3 Add the setup steps: `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` with `node-version: lts/*` and `cache: pnpm`, then `pnpm install --frozen-lockfile`
- [x] 1.4 Add a `Collect snapshot` step running `pnpm collect`; verify there is no `push` trigger and no deploy step anywhere in the workflow
- [x] 1.5 Add a `Check snapshot history` step (`id: history`) that counts `data/snapshots/*.json` and writes `ready=true` when the count is at least 2, otherwise `ready=false`; verify the count command does not fail when the directory is empty or absent
- [x] 1.6 Add a `Generate change report` step gated on `steps.history.outputs.ready == 'true'` running `pnpm diff`; verify it cannot run without a fresh snapshot
- [x] 1.7 Add a `Regenerate latest pointer` step gated on `steps.history.outputs.ready == 'true'` running `pnpm latest`
- [x] 1.8 Add a `Validate` step (`if: steps.history.outputs.ready == 'true'`) running `pnpm lint`, `pnpm typecheck`, and `pnpm test`
- [x] 1.9 Add a `Commit generated data` step that stages exactly `data/snapshots`, `data/changes`, and `data/latest.json`, sets the bot identity, commits `chore(data): update generated data` only when `git diff --cached --quiet` reports changes, and pushes with the persisted `GITHUB_TOKEN` via `git push origin HEAD:main`; verify no `[skip ci]`, no `paths-ignore`, and no PAT
- [x] 1.10 Delete `.github/workflows/deploy.yml`
- [x] 1.11 Verify the workflow contains no Cloudflare secrets, no build step, no deploy step, and no `push` trigger

## 2. Verification (local)

- [x] 2.1 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` locally and verify all exit 0
- [x] 2.2 Validate the workflow YAML and verify against the spec: two daily UTC crons, manual trigger, fixed pipeline order, bootstrap branch, least-privilege permissions, single concurrency group, generated-only commit paths, and no deploy

## 3. Repository setup (deferred, manual)

- [ ] 3.1 Confirm `origin` points to `https://github.com/nebelorz/opencode-sentry.git` (already configured), push `main` to it, and set upstream tracking; verify `git remote -v` shows `origin` and `git status` reports `main` tracking `origin/main`
- [ ] 3.2 Ensure `main` allows `github-actions[bot]` to push generated-data commits (leave `main` unprotected or grant a bypass)

## 4. Verification (deferred, requires section 3)

- [ ] 4.1 Trigger a `workflow_dispatch` run and verify collection, diff, `latest`, lint/typecheck/test, and the generated-data commit all succeed
- [ ] 4.2 Verify the generated-data commit used the bot identity and did not start a second workflow run
- [ ] 4.3 Verify the committed `data/latest.json` and the referenced snapshot/change report are fresh and schema-valid
- [ ] 4.4 Verify bootstrap behavior on a scratch branch or fork: with fewer than two snapshots, a run collects and commits the snapshot only, skips `diff`, `latest`, validation, and the derived commit, and reports no fabricated change report
- [ ] 4.5 Verify failure behavior: make one stage fail (for example `latest`) and confirm the run stops with a non-zero status before commit and publishes no generated data
