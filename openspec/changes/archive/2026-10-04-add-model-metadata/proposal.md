## Why

After pricing lands, the committed snapshot still says nothing about each model's context window, output limit, modalities, or capabilities, so the review cannot tell whether a model can even accept the user's input or whether it supports tools and reasoning. models.dev publishes a per-provider model catalog, and its `opencode-go` provider uses the same model ids as the Go Endpoints table, so it can be matched deterministically and attached to the snapshot as facts.

## What Changes

- Add an enrichment stage to the collection pipeline that fetches the models.dev catalog over HTTPS, selects the `opencode-go` provider, and matches each snapshot model by its exact model id.
- Add an optional `metadata` object to each snapshot model entry with the selected fields: context and output limits, input and output modalities, capability flags (attachment, reasoning, tool call, structured output, temperature, open weights), family, knowledge cutoff, release date, and the canonical model id.
- Store only those selected fields. Provider endpoints, API base URLs, environment variable names, package names, and free-text descriptions SHALL NOT be stored.
- When a model has no models.dev entry, omit `metadata` for that model rather than inventing values, and let the review disclose it.
- Update the `quota-watch` review to present context, modalities, and capabilities from the committed metadata, to keep suitability claims labeled as judgment, and to stop listing context window and capabilities as data gaps.
- Additive and backward compatible: existing model fields are unchanged, historical snapshots remain valid, `schemaVersion` stays `1`, and the diff and API are unchanged.

## Capabilities

### New Capabilities

- `model-metadata`: fetching the models.dev `opencode-go` catalog, matching it to snapshot models by id, selecting and validating metadata, and attaching an optional `metadata` object to snapshot model entries, with explicit omission when an entry is missing.

### Modified Capabilities

- `quota-scraper`: the collection source contract is clarified so the docs page remains the quota and pricing source while models.dev is a separate enrichment source fetched by the metadata stage.
- `quota-watch-review`: the review presents committed metadata as facts, distinguishes capability facts from quality judgment, and no longer reports context window or capabilities as data gaps.

## Impact

- New module under `src/metadata/`, plus integration in `src/collector/index.ts` and `src/schema/snapshot.ts`, and their tests.
- `.opencode/skills/quota-watch/SKILL.md` and the installed copy at `~/.config/opencode/skills/quota-watch/SKILL.md`.
- No new dependency (fetch and validation reuse existing tooling), no diff change, no API change.
- Depends on `add-go-pricing`: assumes snapshot model entries and the review already carry pricing.
