## 1. Dependencies and fixtures

- [x] 1.1 Add `cheerio` and `zod` to `dependencies` with `pnpm add cheerio zod`, then verify `pnpm install` succeeds from the lockfile and neither package appears under `devDependencies`
- [x] 1.2 Create `tests/fixtures/opencode-go.valid.html` containing both an `Estimated requests` table (headers `Model`, `requests per 5 hour`, `requests per week`, `requests per month`, rows with thousands-separated numbers and at least one `Unlimited`) and an `Endpoints` table (headers `Model`, `Model ID`, `Endpoint`, `AI SDK Package`, with Model IDs that differ from any name slug); also create `tests/fixtures/opencode-go.reordered-headers.html` with both headers in a different order; verify both files are present and parse as HTML
- [x] 1.3 Create Estimated Requests failure fixtures `opencode-go.estimated-missing-section.html`, `.estimated-missing-table.html`, `.estimated-empty-table.html`, `.estimated-malformed-table.html`, and `.estimated-invalid-values.html` under `tests/fixtures/`; verify each file exists and contains its intended structural variation
- [x] 1.4 Create Endpoints failure fixtures `opencode-go.endpoints-missing-section.html`, `.endpoints-missing-table.html`, `.endpoints-missing-model-header.html`, `.endpoints-missing-id-header.html`, `.endpoints-empty-table.html`, and `.endpoints-malformed-table.html` under `tests/fixtures/`; verify each file exists and contains its intended structural variation
- [x] 1.5 Create matching fixtures `opencode-go.endpoints-duplicate-name.html`, `.endpoints-duplicate-id.html`, `.unmatched-model.html`, and `.extra-endpoints-model.html` under `tests/fixtures/`; verify each file exists and represents its intended case

## 2. Snapshot schema

- [x] 2.1 Implement `src/schema/snapshot.ts` exporting the quota value schema (non-negative integer or literal `unlimited`), the snapshot schema (`schemaVersion`, `source`, `scrapedAt`, non-empty `models` with `id`, `name`, and `estimatedRequests.{fiveHour,weekly,monthly}`), and the inferred TypeScript types; verify `pnpm typecheck` exits 0
- [x] 2.2 Add `tests/collector/schema.test.ts` asserting the schema accepts a valid snapshot including an `unlimited` value and rejects a missing quota period, a negative value, a decimal value, an empty `models` array, and an unexpected `schemaVersion`; verify `pnpm test` passes

## 3. Fetch

- [x] 3.1 Implement `src/collector/fetch.ts` that requests the source URL and returns the response body as HTML text, throwing a descriptive error on a non-success status or a rejected request; verify `tests/collector/fetch.test.ts` passes with an injected fake fetch for both a successful response and a failure

## 4. Parse

- [x] 4.1 Implement `src/collector/parse.ts` exposing an Estimated Requests parser that locates the `Estimated requests` heading, selects the table that follows it, reads the header row, maps the model and three quota columns by normalized header text into column indexes, and returns the header indexes plus raw data rows; verify `tests/collector/parse.test.ts` passes for the valid fixture and the reordered-headers fixture
- [x] 4.2 Make the Estimated Requests parser throw when the section is missing, the table is missing, a required header is absent, the table has no data rows, a row's cell count differs from the header, or the table structure cannot be read as header plus rows; verify each case is covered by a passing test using the corresponding fixture
- [x] 4.3 Implement an Endpoints parser in `src/collector/parse.ts` that locates the `Endpoints` heading, selects the table that follows it, reads the header row, maps the Model and Model ID columns by normalized header text into column indexes, returns the raw model name and model ID pairs, and ignores the Endpoint and AI SDK Package columns; verify `tests/collector/parse.test.ts` passes for the valid and reordered-headers fixtures
- [x] 4.4 Make the Endpoints parser throw when the section is missing, the table is missing, the Model header is absent, the Model ID header is absent, the table has no data rows, or a row is malformed (missing cell or cell count differing from the header); verify each case is covered by a passing test using the corresponding fixture
- [x] 4.5 Make the Endpoints parser throw on duplicate model names and on duplicate model IDs; verify `tests/collector/parse.test.ts` covers both cases with the duplicate-name and duplicate-id fixtures

## 5. Normalize and match

- [x] 5.1 Implement `src/collector/normalize.ts` with a name-key function (trim and collapse whitespace runs, including HTML whitespace, to a single space) and a quota-cell function (trim, remove thousands separators, accept a non-negative integer or `Unlimited` as `unlimited`, throw on placeholders, decimals, and negatives); verify `tests/collector/normalize.test.ts` passes for comma-separated numbers, surrounding and repeated whitespace, non-breaking whitespace, `Unlimited`, placeholders such as `-`/`N/A`, decimal and negative values
- [x] 5.2 Implement `src/collector/match.ts` that joins Estimated Requests rows to Endpoints entries by the normalized name key, takes each model `id` verbatim from the matched Endpoints Model ID, ignores Endpoints entries that no quota row references, and throws on a missing mapping and on an ambiguous mapping (an Estimated row matching more than one entry, or two Estimated rows matching the same entry); verify `tests/collector/match.test.ts` asserts ids come from the Endpoints table while quotas come from the Estimated Requests table, and covers the unmatched-model and extra-endpoints-model fixtures

## 6. Snapshot assembly and validation

- [x] 6.1 Implement `src/collector/snapshot.ts` that builds the snapshot from matched models with `schemaVersion: 1`, the `source` object (`provider: "opencode"`, `plan: "go"`, canonical URL without fragment), a UTC ISO 8601 `scrapedAt`, and validates the result with the schema before returning it; verify `tests/collector/snapshot.test.ts` passes for correct metadata, for the Endpoints-sourced id, for absence of endpoint metadata, and for rejection of a schema-invalid candidate

## 7. Immutable persistence

- [x] 7.1 Implement `src/collector/persist.ts` that derives the filename from `scrapedAt` (UTC, minute precision, `:` replaced by `-`, `.json`), creates `data/snapshots/` recursively, and writes the JSON with an exclusive-create flag; verify `tests/collector/persist.test.ts` passes for writing a new file, failing with `EEXIST` without altering an existing file, and leaving no partial file after a rejected write

## 8. Orchestration and end-to-end

- [x] 8.1 Implement `src/collector/index.ts` exporting `collectQuotaSnapshot(options)` that wires fetch -> parse Estimated Requests -> parse Endpoints -> normalize -> match -> build/validate -> persist, with injectable `fetchImpl`, `now`, `url`, and `outputDir` defaulting to global `fetch`, the current time, the documented URL, and `data/snapshots`; verify an end-to-end test runs the valid fixture through the full pipeline once into a temporary directory and asserts a schema-valid snapshot file is written only on success
- [x] 8.2 Add `tests/collector/live.integration.test.ts` gated behind an environment variable (for example `LIVE_SOURCE=1`) that fetches the real page and asserts a valid snapshot is produced; verify `pnpm test` passes with the gate unset and performs no network request

## 9. Final verification

- [x] 9.1 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` and verify every command exits 0 with no network access
- [x] 9.2 Verify the collector contains no diff, change-report, API route, scheduling, deployment, Git-commit, CLI, database, recommendation, fuzzy-matching, model-registry, or `/zen/go/v1/models` fetching code, and that no snapshot file is written when any stage fails
