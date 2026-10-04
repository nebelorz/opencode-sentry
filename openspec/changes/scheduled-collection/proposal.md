## Why

The pipeline is complete in code (`collect`, `diff`, `latest`), but nothing runs it on a schedule or commits the generated data, so the raw GitHub interface would serve stale data. This change adds the missing delivery path: a scheduled, validated, loop-free GitHub Actions workflow that collects, regenerates the latest pointer, and commits the generated artifacts. It deliberately replaces the earlier Cloudflare-oriented `deployment` plan, which is no longer used.

## What Changes

- Add `.github/workflows/collect.yml` triggered by `schedule` at `00:15` and `12:15` UTC and by manual `workflow_dispatch`.
- Run the pipeline in a fixed order: `pnpm collect` (scheduled/manual only), `pnpm diff` (only after a new collect and with at least two snapshots), `pnpm latest`, then the validation gate (`lint`, `typecheck`, `test`).
- Define explicit first-run bootstrap: with fewer than two snapshots, only collection runs and is committed; `diff`, `latest`, the validation gate, and the commit of derived artifacts are skipped until a second snapshot exists.
- Commit exactly the generated artifacts (`data/snapshots/*.json`, `data/changes/*.json`, `data/latest.json`) with a deterministic bot identity and no commit when nothing changed.
- Prevent workflow loops by pushing with the repository `GITHUB_TOKEN`, so the generated-data commit starts no new workflow run.
- Protect production with a single `concurrency` group (`cancel-in-progress: false`) and least-privilege `GITHUB_TOKEN` permissions (`contents: write`).
- Fail the workflow loudly on any collection, diff (outside bootstrap), pointer, validation, or commit failure, and never commit partial or invalid data.
- Delete the obsolete `.github/workflows/deploy.yml` Cloudflare workflow.

Out of scope: deployment of any kind, Cloudflare or other secrets, a `push` deploy trigger, building a Worker, new API endpoints, recommendation logic, database or external storage, authentication, custom domains, and changes to parsing, diff semantics, or schemas. The existing `ci.yml` is left unchanged.

## Capabilities

### New Capabilities

- `scheduled-collection`: the production data-refresh pipeline. It schedules collection twice daily, regenerates the latest pointer, validates, and commits the generated artifacts deterministically, with explicit bootstrap, concurrency, loop-avoidance, and failure behavior.

### Modified Capabilities

- None.

## Impact

- Add `.github/workflows/collect.yml`; delete `.github/workflows/deploy.yml`.
- Use the `latest` package script from the `latest-pointer` capability.
- Committed generated artifacts become part of the normal history: `data/snapshots/*.json`, `data/changes/*.json`, and `data/latest.json`.
- No secrets are required. No data format, schema, collector, diff, or CLI behavior changes, and no new dependency is added.
- Depends on the `remove-public-api` change, which introduces the `latest` script; apply it first.
