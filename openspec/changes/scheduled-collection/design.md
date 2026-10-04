## Context

See `proposal.md` for motivation and `specs/scheduled-collection/spec.md` for the behavior contract.

Current state (verified against the repository):

- Stages exist as package scripts after `remove-public-api`: `collect` (`node src/cli/collect.ts`), `diff` (`node src/cli/diff.ts`), and `latest` (`node src/cli/latest.ts`).
- `pnpm collect` writes an immutable snapshot to `data/snapshots/<minute>.json` with an exclusive `wx` flag (`src/collector/persist.ts`); the filename comes from `scrapedAt` (UTC, minute precision, `:` replaced by `-`).
- `pnpm diff` reads every `*.json` in `data/snapshots/`, validates and orders them, compares the latest two, and writes `data/changes/<latest-snapshot-minute>.json` with `wx` (`src/diff/load.ts`, `src/diff/persist.ts`). `selectLatestTwo` throws when fewer than two snapshots exist.
- `pnpm latest` selects the newest snapshot and newest change report by lexicographic filename, validates both with the existing Zod schemas, and rewrites `data/latest.json`. It fails if either directory has no `*.json` file.
- `.github/workflows/ci.yml` runs checkout, pnpm, Node `lts/*`, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` on push and pull request.
- `.github/workflows/deploy.yml` (uncommitted) targets Cloudflare and is replaced by this change.
- `package.json` pins `packageManager: pnpm@11.24.0` and `engines.node: ">=22.18.0"`. `.gitignore` does not exclude `data/`, so generated data is tracked.
- The GitHub remote exists at `https://github.com/nebelorz/opencode-sentry.git` and is configured locally as `origin`; `main` must be pushed there before scheduled runs can commit generated data.

Constraints: keep modules small; no database, external storage, queues, webhooks, or unnecessary abstractions; keep history in Git; use UTC; make the pipeline deterministic and fail loudly; do not change diff semantics or parsing.

## Goals / Non-Goals

**Goals:**

- One workflow that schedules collection twice daily and commits the generated artifacts.
- Guaranteed freshness of `data/latest.json` from `data/`.
- Explicit, safe bootstrap when fewer than two snapshots exist.
- Loop-free generated-data commits using only the repository token.
- Serialized production runs and least-privilege token permissions.
- Reproducible install and a clear, loud failure at every stage.

**Non-Goals:**

- No deploy of any kind, no Cloudflare secrets, no `push` deploy trigger.
- No second/parallel workflow, no `workflow_run` chaining, no PAT, no `repository_dispatch`.
- No database, KV/R2/D1, secrets store, or external data storage.
- No custom domain, no CORS, no auth, no API routes, no recommendation/ranking logic.
- No changes to `ci.yml`, collector, diff, or schemas.

## Decisions

**1. One workflow, no deploy.**

A single `.github/workflows/collect.yml` handles `schedule` and `workflow_dispatch`. The previous design included a `push` trigger and a Cloudflare deploy step; both are removed because the Worker is deleted and raw GitHub is the delivery interface. Code changes are still validated on push and pull request by the unchanged `ci.yml`; the next scheduled run collects against the updated code.

**2. Trigger strategy.**

```yaml
on:
  schedule:
    - cron: "15 0 * * *"
    - cron: "15 12 * * *"
  workflow_dispatch:
```

`cron` in GitHub Actions is always UTC, so these map to `00:15` and `12:15` UTC as required. `workflow_dispatch` is the manual fallback.

**3. Pipeline order, exactly.**

```text
install (frozen)
  -> collect                (schedule/workflow_dispatch only)
  -> count snapshots        (bootstrap detection)
  -> diff                   (only if collected and >= 2 snapshots)
  -> latest                 (only if >= 2 snapshots)
  -> lint, typecheck, test  (only if >= 2 snapshots)
  -> commit generated data  (always; commits only if paths changed)
```

`latest` runs before the validation gate and commit, so the committed pointer always reflects the newest data. `diff` is safe on a collecting run because `collect` has just created a newer snapshot than any existing change report's source. `diff` MUST NOT run when no new snapshot was collected, because it would target an existing latest-snapshot timestamp where an immutable change report may already exist and fail with `EEXIST`.

**4. Bootstrap is a first-class branch.**

`pnpm diff` requires two snapshots and is intentionally left untouched. After collection the workflow counts `data/snapshots/*.json`:

- `count >= 2`: normal pipeline.
- `count < 2`: bootstrap. Only collection runs; the new snapshot is committed; `diff`, `latest`, the validation gate, and the derived-artifact commit are skipped. The next run finds two snapshots and runs the full pipeline.

Bootstrap skips the validation gate because without a second snapshot there is no change report and `latest` fails. Skipping is preferable to inventing a synthetic report, which would change diff semantics.

**5. Generated artifacts and commit strategy.**

The only committed generated paths are `data/snapshots/*.json`, `data/changes/*.json`, and `data/latest.json`. The commit step stages exactly those paths, then:

```sh
if git diff --cached --quiet; then
  echo "No generated data changes to commit."
else
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git commit -m "chore(data): update generated data"
  git push origin HEAD:main
fi
```

The bot identity is the fixed GitHub Actions bot. `git diff --cached --quiet` guarantees no empty commit.

**6. Workflow loops are avoided by the `GITHUB_TOKEN` push behavior.**

The commit is pushed with the default `GITHUB_TOKEN` (actions/checkout persists it). GitHub's documented behavior is that events triggered with the repository's `GITHUB_TOKEN` do not create new workflow runs. `permissions: contents: write` authorizes the push. No PAT, no `paths-ignore`, and no `[skip ci]` marker are used, because the token push already starts no run.

**7. Concurrency and permissions.**

```yaml
permissions:
  contents: write

concurrency:
  group: production-collect
  cancel-in-progress: false
```

One group means a second run waits instead of running concurrently, and `cancel-in-progress: false` avoids cancelling a run mid-commit.

**8. Reproducible install and Node version.**

`pnpm/action-setup@v4` reads the pinned `packageManager`, `actions/setup-node@v4` uses `node-version: lts/*` exactly as `ci.yml` does, and install uses `pnpm install --frozen-lockfile`.

**9. Failure behavior.**

Every stage is its own step, so a non-zero exit fails the run and later steps do not execute. Collection failure stops before diff; a non-bootstrap diff failure stops before commit; `latest` failure stops before validation and commit; validation failure stops before commit; a failed push fails the run. The previous committed data and the raw GitHub interface are left untouched on failure.

## Risks / Trade-offs

- Branch protection could reject the bot's direct push to `main` -> leave `main` unprotected or allow `github-actions[bot]`; recorded as an open question.
- `pnpm collect` uses minute-precision filenames with an exclusive create, so two runs in the same minute would collide (`EEXIST`) -> scheduled times differ and the concurrency group serializes runs; a same-minute manual rerun fails loudly (accepted).
- GitHub `schedule` runs can be delayed under load and are disabled after long repository inactivity -> accepted; `workflow_dispatch` is the manual fallback.
- A human push that races the workflow's generated-data push could make the `git push` non-fast-forward and fail the run -> the concurrency group serializes production runs; a raced push fails loudly (accepted).
- Floating `lts/*` can pick up a new Node major over time -> any LTS satisfies `engines`; pin via `node-version-file` if that changes.

## Migration Plan

1. Add `.github/workflows/collect.yml` and delete `.github/workflows/deploy.yml`.
2. Push `main` to the existing `origin` remote and track it.
3. Trigger one manual `workflow_dispatch` run and confirm collect, diff, `latest`, validation, and commit succeed.
4. Rollback: delete the workflow file; existing snapshots, change reports, and the pointer are unaffected. No data migration is required.

## Open Questions

- Will `main` be branch-protected, and if so, should `github-actions[bot]` be granted a bypass so generated-data commits can be pushed directly? This affects repository settings only.
