## Why

The committed snapshot stores only `estimatedRequests`, so the review can compare how much usage each model allows but not what that usage costs. The same OpenCode Go docs page also publishes per-model token prices and monthly USD limits for both the Go and Go Plus plans. Collecting that pricing turns the review from a usage-count proxy into a real cost-efficiency comparison.

## What Changes

- Extend the collector to read the **Pricing** tables from the same OpenCode Go docs page, for both the **Go** and **Go Plus** plans, in addition to the existing Estimated Requests and Endpoints tables.
- Add an optional `pricing` array to each snapshot model: one entry per plan and price variant, each carrying input, output, cached read, and cached write USD prices per 1M tokens plus that model's monthly limit in USD (or `unlimited`).
- Preserve price variants that the source expresses as separate rows: peak and off-peak (DeepSeek, and the base rows), token-tier splits (Qwen3.7 Plus, Grok, GPT Luna), and models with no variant.
- Treat `Free` prices as zero and an absent cached-write price as `null`.
- Additive and backward compatible: existing model fields are unchanged, historical snapshots remain valid, `schemaVersion` stays `1`, and the diff and API are unchanged.
- Update the `quota-watch` review to rank value using the committed prices and monthly limits, and to stop listing currency price as an uncollected gap.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `quota-scraper`: the collector locates and parses the Go and Go Plus Pricing tables, normalizes prices and monthly limits, matches pricing rows to models, and attaches an optional `pricing` array to each snapshot model entry.
- `quota-watch-review`: the review ranks models using committed pricing and monthly limits, states that `estimatedRequests` is a quota while token prices and monthly limits are collected separately, and no longer reports currency price as a data gap.

## Impact

- `src/collector/parse.ts`, `src/collector/normalize.ts`, `src/collector/match.ts`, `src/collector/snapshot.ts`, `src/schema/snapshot.ts`, and their tests.
- `.opencode/skills/quota-watch/SKILL.md` and the installed copy at `~/.config/opencode/skills/quota-watch/SKILL.md`.
- No new dependency, no diff change, no API change, no collector output directory change.
- Prerequisite for `add-model-metadata`, which adds optional model metadata on top of this shape.
