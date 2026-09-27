## Why

The project exists to detect when OpenCode Go model quotas change, but nothing currently reads the source data. The foundation (`project-scaffolding`) provides an install, test, lint, and build loop with no pipeline behavior. This change builds the first pipeline stage: fetching the documentation once, parsing the **Estimated Requests** and **Endpoints** tables, matching them to obtain stable model IDs, validating the result, and persisting an immutable JSON snapshot. No later change (diff, API, deployment) can work without a trusted snapshot.

## What Changes

- Fetch the official OpenCode Go documentation page (`https://opencode.ai/v2/docs/console/go`) over HTTPS once per run.
- Locate the `### Estimated requests` section and the `## Endpoints` section and their tables by semantic structure (heading text and table headers), not by CSS classes or visual selectors.
- Read the Estimated Requests headers (`Model`, `requests per 5 hour`, `requests per week`, `requests per month`) and map them to the snapshot quota periods regardless of column order.
- Read the Endpoints headers (`Model`, `Model ID`, `Endpoint`, `AI SDK Package`) and use only `Model` and `Model ID`.
- Match models between the two tables by normalized model name, reconciling only whitespace differences; no fuzzy, similarity, partial, or AI matching.
- Take each snapshot model `id` verbatim from the Endpoints `Model ID` column. Do not derive ids from display names and do not invent ids.
- Fail the collection (no file written) when a model with quota data cannot be matched unambiguously, when Endpoints has duplicate names or ids, or when any required section, table, header, row, or value is missing or malformed.
- Ignore Endpoints models that have no Estimated Requests entry; the snapshot represents models with quota data.
- Normalize quota cells by trimming and removing thousands separators; represent the supported special value `Unlimited` explicitly and reject anything else non-numeric.
- Validate the assembled snapshot with Zod before it can be written.
- Write a validated snapshot to `data/snapshots/<timestamp>.json` with a `schemaVersion`, source metadata, and a UTC `scrapedAt`, never overwriting an existing file.
- Document `https://opencode.ai/zen/go/v1/models` as a potential future source of model metadata. Do not fetch it, depend on it, or duplicate its metadata in snapshots in this change.
- Add `cheerio` and `zod` as dependencies.
- Add Vitest tests with local HTML fixtures for both tables covering parsing, matching, id sourcing, normalization, special values, invalid values, missing/empty/malformed tables, missing/ambiguous mappings, duplicate ids, extra Endpoints models, schema validation, and snapshot generation, plus an opt-in live-source integration test that is skipped by default.

Out of scope for this change: diff detection, change reports, `/api/v1/current`, `/api/v1/changes`, Cloudflare deployment, scheduled GitHub Actions collection, automatic Git commits, OpenCode plugins or skills, CLI, database or external storage, model recommendations, model capability analysis, historical API queries, generic model registry abstractions, fuzzy model matching, and fetching `/zen/go/v1/models`.

## Capabilities

### New Capabilities

- `quota-scraper`: the collection pipeline. It fetches the OpenCode Go documentation, extracts and normalizes the Estimated Requests and Endpoints tables, matches models by normalized name to obtain stable ids, validates the result against the snapshot schema, and persists an immutable, validated JSON snapshot.

### Modified Capabilities

- None.

## Impact

- New collector and schema code under `src/collector/` and `src/schema/`.
- New data output under `data/snapshots/`.
- New test fixtures and tests under `tests/`, including fixtures for the Endpoints table.
- Dependencies added: `cheerio` (HTML parsing) and `zod` (validation). Node's built-in `fetch` is used for HTTP.
- No API routes, diff logic, scheduling, `/zen/go/v1/models` fetching, or deployment changes.
