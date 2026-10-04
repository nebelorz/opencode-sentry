## Context

See proposal.md - Why. The collector already fetches one OpenCode Go docs page and reads the Estimated Requests and Endpoints tables from it. The same page also renders two Pricing tables (Go and Go Plus) and two Estimated Requests tables through plan tabs. Today only the Go Estimated Requests values are stored; no price, limit, or plan variant is captured. The snapshot schema is versioned with `schemaVersion: 1`, and the diff loader re-validates every historical snapshot against that schema on each run, so any shape change must keep old files loadable.

## Goals / Non-Goals

**Goals:**

- Capture real economics: per-model token prices and monthly USD limits for both plans.
- Preserve the Go and Go Plus distinction and the source's price variants.
- Keep the change additive and backward compatible so historical snapshots and the diff loader keep working.

**Non-Goals:**

- Scraping the plan subscription price (`$10` / `$40`) or the per-request token-count assumptions.
- Diffing price changes. The diff continues to compare Estimated Requests only.
- Splitting `estimatedRequests` per plan. It stays the Go-plan value it is today.
- Adding context window or capabilities; that is `add-model-metadata`.

## Decisions

**Optional `pricing` array on model entries, no version bump.**
Each model entry gains an optional `pricing` array; existing required fields are untouched and `schemaVersion` stays `1`. Historical snapshots without `pricing` remain valid and the diff loader needs no change. Alternative considered: bump to `schemaVersion: 2` and make the schema a discriminated union of versions; rejected as extra code and diff-loader surface for an additive, backward-compatible change.

**Flat per-row pricing entries rather than a nested per-plan tree.**
Each entry is `{ plan, variant, variantLabel, input, output, cachedRead, cachedWrite, monthlyLimit }`. This mirrors the source rows one-to-one, keeps validation simple, and lets the skill render variants directly without re-deriving them. Alternative considered: `pricing.go.{peak,offPeak}` nesting; rejected because the variant taxonomy differs per model (peak/off-peak vs token tiers) and a fixed tree does not fit.

**Locate pricing tables by header set, not by heading text.**
The pricing tables share the "Usage limits" area with the Estimated Requests tables, so heading-based lookup is ambiguous. The collector selects tables whose header row contains Model, Input, Output, Cached Read, Cached Write, and Monthly limit, and associates each with a plan from its tab context. Alternative considered: heading text; rejected because no reliable unique heading exists.

**Match pricing rows by the existing normalized name key.**
Strip the parenthetical qualifier to get the base name, then match with the same `nameKey` used for Estimated Requests and Endpoints. Multiple variants per model and plan are allowed. A pricing row with no matching model, or a model with no pricing for a plan, fails the collection. Alternative considered: tolerate missing pricing; rejected because it would publish partial economics silently.

**Free is zero and absent optional prices are `null`.**
`Free` normalizes to `0`, and `-` normalizes to `null`. The monthly limit normalizes to `{ amount, currency: "USD" }` or `unlimited`. Alternative considered: keep `free` and `-` as sentinels; rejected because typed numeric values are easier to validate and compare.

**`source.plan` stays `go`.**
The page's primary plan is Go, and `source` describes the page, not the priced entries. Both plans are represented inside each model's `pricing` array. Alternative considered: an array of sources; rejected as unnecessary for this change.

## Risks / Trade-offs

- [Pricing table shape changes upstream] -> Header-driven structural lookup plus fail-loud collection; no partial snapshot is written.
- [A new qualifier the parser does not recognize] -> Base-name extraction is qualifier-agnostic and the source label is preserved; only genuinely new model names would fail, which is correct.
- [Requiring pricing for every model and plan is strict] -> It fails loudly instead of publishing partial economics; if the source lags, collection fails and the last good snapshot stays in place.
- [`schemaVersion` no longer signals the new fields] -> The change is explicitly additive and documented; consumers treat missing `pricing` as not collected.

## Migration Plan

No data migration. Historical snapshots stay valid and loadable. Deploy the updated collector, run `pnpm collect` to publish the first snapshot with pricing, then update the skill. Rollback is reverting the collector and skill; committed snapshots are immutable and unaffected.
