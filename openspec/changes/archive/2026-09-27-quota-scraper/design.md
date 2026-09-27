## Context

See `proposal.md` for motivation. The starting point is the `project-scaffolding` foundation: a single pnpm and TypeScript package with Vitest, ESLint, Prettier, a stub Hono Worker at `src/api/index.ts`, and CI. Zod and Cheerio are deliberately not installed yet. `AGENTS.md` fixes the principles: small single-purpose modules, no abstraction without a concrete need, validate external data, never publish partial snapshots, UTC everywhere, prefer existing tooling.

The collector runs on Node (GitHub Actions), not on the Worker. It is the first stage of `Collector -> validated snapshot -> diff -> JSON -> API` and must not contain any diff or API concern.

The live source page (`https://opencode.ai/v2/docs/console/go`) contains two tables that this change reads from one fetched document:

- `### Estimated requests`: headers `Model`, `requests per 5 hour`, `requests per week`, `requests per month`; the authoritative source for model names and quotas.
- `## Endpoints`: headers `Model`, `Model ID`, `Endpoint`, `AI SDK Package`; the authoritative source for stable model IDs.

The page also links a model metadata endpoint, `https://opencode.ai/zen/go/v1/models`. It is documented here as a possible future source of additional model metadata but is not fetched, not required, and its data is not duplicated into snapshots in this change.

The parser is built against the current structure but must assume it can change.

## Goals / Non-Goals

**Goals:**

- A small, readable collection pipeline that fetches once, parses both tables, matches models by normalized name, validates, and persists one snapshot.
- Parsers driven by heading text and table headers, not CSS classes or visual selectors, and resilient to column reordering.
- Stable snapshot ids taken verbatim from the Endpoints table.
- A snapshot model that is JSON-safe, versioned, and validated before any file is written.
- Fail-safe behavior: any fetch, parse, normalization, matching, or validation error aborts the run with no file written.
- Unit tests driven by local HTML fixtures for both tables; network is never required.

**Non-Goals:**

- No diff, change report, previous-snapshot loading, or comparison.
- No API routes and no dependency on the Worker runtime.
- No scheduling, deployment, Git commits, CLI, database, or plugin.
- No generic scraping framework, repository layer, dependency injection container, model registry, or factory hierarchy.
- No fuzzy, similarity, partial, or AI-based model matching.
- No fetching or dependency on `/zen/go/v1/models`.
- No retry, backoff, or rate-limit handling beyond a single request.

## Decisions

**1. Module layout under `src/collector/` plus `src/schema/`.**

```
src/
  schema/snapshot.ts      Zod schema + inferred types + quota value type
  collector/fetch.ts      fetch the source HTML once
  collector/parse.ts      locate both sections/tables, read headers and raw rows
  collector/normalize.ts  normalize names (matching key) and quota cells
  collector/match.ts      join Estimated Requests rows to Endpoints entries
  collector/snapshot.ts   assemble + validate the snapshot object
  collector/persist.ts    write the snapshot file immutably
  collector/index.ts      orchestration: fetch -> parse -> normalize -> match -> build -> validate -> persist
```

Each module has one job, matching the spec's requirement to keep fetching, parsing, normalization, validation, and persistence separated and independently testable. `match.ts` is a separate small module because joining two independently parsed tables is a distinct concern from normalizing individual values. Alternative considered: a single `collector.ts`. Rejected because it would mix all five concerns.

**2. Cheerio for parsing; semantic selection of both tables.**

Cheerio parses the HTML into a queryable DOM. For each of the two tables, the parser finds a heading (`h2`-`h4`) whose normalized text equals `estimated requests` or `endpoints`, then takes the first `table` that follows that heading as a sibling or descendant. It does not use class names such as `docs-table-scroll`. Alternative considered: regex over raw HTML. Rejected because it is brittle and cannot reliably associate a table with its heading.

**3. Header-driven column mapping for both tables.**

Header cells are normalized (lowercase, collapse whitespace) and mapped by content. For Estimated Requests: the model header contains `model`, the 5-hour header matches `5 hour`/`five hour`, the weekly header contains `week`, and the monthly header contains `month`. For Endpoints: the model header contains `model` and the model ID header contains `model id`. Mapping produces column indexes, so columns may appear in any order. For Endpoints, only the Model and Model ID columns are read; Endpoint and AI SDK Package are ignored. Alternative considered: fixed column positions. Rejected because a reordered table would silently produce wrong data.

**4. Model IDs come from the Endpoints table; models are joined by normalized name.**

The Estimated Requests table has no identifiers, so the id is not derived from the display name. Instead, each Estimated Requests row is matched to an Endpoints row by a matching key computed from the model name: trim surrounding whitespace and collapse runs of whitespace (including non-breaking and other HTML whitespace) to a single space. Cheerio decodes HTML entities before the name is normalized, and JavaScript `\s` matches `\u00A0`, so equivalent HTML whitespace collapses correctly. The match is exact and case-sensitive on the normalized key; no fuzzy, similarity, partial, or AI matching is used. The snapshot id is the matched Endpoints `Model ID` value, verbatim.

Matching is one-to-one and fails loudly rather than guessing:

- A normalized Endpoints name that repeats is a duplicate-name error.
- A `Model ID` that repeats is a duplicate-id error.
- An Estimated Requests row with no Endpoints match is a missing-mapping error; the collector does not invent an id and does not silently drop the row.
- An Estimated Requests row that maps to an already-used Endpoints entry (duplicate name on the Estimated side) is an ambiguous-mapping error.
- Endpoints entries that no Estimated Requests row references are simply ignored; the snapshot represents models with quota data.

Alternative considered: deriving a slug id from the name (the previous plan). Rejected because the source provides an authoritative id and the spec forbids inventing one.

**5. Quota value representation.**

A quota value is either a non-negative integer or the literal string `unlimited`. The special source value `Unlimited` is represented as `unlimited`; `Infinity`/`NaN` are never used because they are not valid JSON. Missing, empty, placeholder (`-`, `N/A`, `TBD`), decimal, or negative values are errors, not values, because the spec forbids publishing a partial snapshot. Numeric cells are normalized by trimming and removing thousands separators before integer parsing.

**6. Snapshot schema in `src/schema/snapshot.ts` with Zod.**

```ts
const quotaValue = z.union([z.number().int().nonnegative(), z.literal("unlimited")]);

const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({
    provider: z.literal("opencode"),
    plan: z.literal("go"),
    url: z.string().url(),
  }),
  scrapedAt: z.string().datetime(),
  models: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        estimatedRequests: z.object({
          fiveHour: quotaValue,
          weekly: quotaValue,
          monthly: quotaValue,
        }),
      }),
    )
    .min(1),
});
```

The schema is the single source of truth for the snapshot shape; the inferred type is exported for the collector to use. `id` carries the Endpoints Model ID verbatim. `source.url` is the canonical page URL without the `#estimated-requests` fragment, matching the example in `EXECUTIVE_SUMMARY.md` section 7. Endpoint URLs, AI SDK packages, and other Endpoints metadata are not part of the schema and are not stored.

**7. Validation gates persistence.**

`src/collector/snapshot.ts` assembles the candidate object and calls `snapshotSchema.parse`. If parsing throws, the error propagates and `persist.ts` is never called. This is the mechanism that guarantees an invalid or partial snapshot is never written.

**8. Immutable persistence with an exclusive write.**

`persist.ts` computes the filename from `scrapedAt`: truncate to minutes, replace `:` with `-`, and append `.json`, giving `data/snapshots/2026-09-27T12-15.json`. It creates the directory recursively and writes UTF-8 JSON with Node's exclusive flag (`fs.writeFile(path, json, { flag: "wx" })`). If the file already exists, the write fails with `EEXIST`, the run aborts, and the historical file is untouched. Alternative considered: check `existsSync` then write. Rejected because the exclusive flag makes the "never overwrite" guarantee atomic. Snapshot JSON is written with a trailing newline and 2-space indentation for readable Git diffs.

**9. Injectable fetch, clock, and output directory.**

`collectQuotaSnapshot(options)` accepts optional `fetchImpl`, `now`, `url`, and `outputDir`, defaulting to global `fetch`, `() => new Date()`, the documented URL, and `data/snapshots`. This keeps tests deterministic and offline without introducing a DI container; it is a plain options argument. Alternative considered: mocking global `fetch` in tests. Rejected in favor of a concrete, small seam.

**10. Errors are plain thrown errors.**

Failures throw `Error` with a clear message (`Endpoints section not found`, `Model "Kimi K3" has no Endpoints entry`, `Duplicate model id "kimi-k3"`, etc.). No custom error class hierarchy is introduced because nothing consumes error types yet. Alternative considered: a `CollectionError` class. Deferred until a caller needs to distinguish failure modes.

**11. Fixtures over live network in tests.**

Representative HTML fixtures live under `tests/fixtures/`, each containing both tables unless it targets a specific failure. A single integration test against the live source is gated behind an environment variable and skipped by default, so the suite passes without network access.

```
tests/
  fixtures/opencode-go.valid.html
  fixtures/opencode-go.reordered-headers.html
  fixtures/opencode-go.estimated-missing-section.html
  fixtures/opencode-go.estimated-missing-table.html
  fixtures/opencode-go.estimated-empty-table.html
  fixtures/opencode-go.estimated-malformed-table.html
  fixtures/opencode-go.estimated-invalid-values.html
  fixtures/opencode-go.endpoints-missing-section.html
  fixtures/opencode-go.endpoints-missing-table.html
  fixtures/opencode-go.endpoints-missing-model-header.html
  fixtures/opencode-go.endpoints-missing-id-header.html
  fixtures/opencode-go.endpoints-empty-table.html
  fixtures/opencode-go.endpoints-malformed-table.html
  fixtures/opencode-go.endpoints-duplicate-name.html
  fixtures/opencode-go.endpoints-duplicate-id.html
  fixtures/opencode-go.unmatched-model.html
  fixtures/opencode-go.extra-endpoints-model.html
  collector/fetch.test.ts
  collector/parse.test.ts
  collector/normalize.test.ts
  collector/match.test.ts
  collector/schema.test.ts
  collector/snapshot.test.ts
  collector/persist.test.ts
  collector/live.integration.test.ts
```

**12. Add only `cheerio` and `zod`.**

Both are required by the spec. Node 22 (the pinned engine) provides global `fetch`, so no HTTP client dependency is added. No test fixture library is added; fixtures are plain files read with Node's `fs`.

**13. `/zen/go/v1/models` is documented, not used.**

The model metadata endpoint is recorded as a possible future source of additional model metadata or an independent validation mechanism. It is not fetched, is not a dependency, and its metadata is not duplicated in snapshots. Adding it would be a separate change.

## Risks / Trade-offs

- The documentation page structure may change (heading text, heading level, table markup), causing a hard failure ([risk]) -> that is the intended fail-safe behavior; the failure is loud, no bad data is published, and the parser is updated with a new fixture.
- The two tables use display names as the join key, so a rename in one table but not the other breaks the match ([risk]) -> the collection fails with a missing-mapping error instead of publishing a wrong or partial snapshot.
- Duplicate names or ids in the Endpoints table ([risk]) -> the collector aborts rather than picking one arbitrarily.
- Whitespace-only normalization is case-sensitive, so a case difference between tables fails the match ([trade-off]) -> intended, because the spec limits normalization to whitespace and forbids fuzzy matching; case handling can be specified later if the source requires it.
- `flag: "wx"` behavior in tests and on the CI filesystem ([risk]) -> tests write to a temporary directory created per test; the exclusive write is exercised directly by a dedicated test.
- Two collection runs within the same minute collide on the filename ([trade-off]) -> accepted for now; the exclusive write turns the second run into a safe failure instead of an overwrite.
- Zod and Cheerio are Node-side dependencies; if the collector were later run on the Worker they would need review ([trade-off]) -> the Worker does not scrape, so this does not arise in the current design.
- The live page is parsed with display-name matching, which is more fragile than a stable foreign key ([trade-off]) -> accepted because the source's only join key across the two tables is the model name; the Endpoints `Model ID` remains the authoritative stored id.

## Migration Plan

No existing code or data is migrated. Apply the tasks in order. There is no rollback beyond discarding generated snapshot files under `data/snapshots/`, which are additive and not referenced by any other component yet.

## Open Questions

- Should model matching fold case or punctuation (for example `Kimi K2.6` vs `Kimi K2.6 ` variants) if the source diverges? Deferrable; the spec currently limits normalization to whitespace and forbids fuzzy matching.
- Should the collector add retry/backoff for transient fetch failures? Deferrable; the fail-safe path is correct either way and scheduling belongs to a later change.
- Should `/zen/go/v1/models` later be used to cross-validate ids? Out of scope; recorded as a future possibility.
- Should old snapshots ever be pruned? Out of scope; the project intentionally preserves history in Git.
