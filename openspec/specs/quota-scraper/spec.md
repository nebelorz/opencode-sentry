# quota-scraper Specification

## Purpose

Collects the OpenCode Go **Estimated Requests** and **Endpoints** tables from the official documentation, matches models between them by normalized name to obtain the stable model IDs, normalizes and validates the result, and persists an immutable, machine-readable JSON snapshot. It is the first stage of the pipeline and publishes data only, never recommendations.

## Requirements

### Requirement: Source is fetched over HTTPS

The collector SHALL fetch the official OpenCode Go documentation page from `https://opencode.ai/v2/docs/console/go` exactly once per collection run as its quota and pricing source. It SHALL extract data from three tables in that single document: the Estimated Requests tables for model names and quotas, the Endpoints table for model names and model IDs, and the Pricing tables for token prices and monthly limits. The metadata enrichment stage SHALL fetch the models.dev catalog separately as its own source. The collector SHALL use each document's semantic content only and SHALL treat every fetched document as untrusted input.

#### Scenario: Source is fetched successfully

- **WHEN** the collector runs and the source responds successfully with an HTML document
- **THEN** the collector proceeds to parse that document

#### Scenario: Both tables are read from one document

- **WHEN** the collector collects a snapshot
- **THEN** it uses a single fetched documentation page to read the Estimated Requests tables, the Endpoints table, and the Pricing tables

#### Scenario: Enrichment uses a separate source

- **WHEN** the collection pipeline runs the metadata enrichment stage
- **THEN** that stage fetches the models.dev catalog as a source separate from the OpenCode Go documentation page

#### Scenario: Fetch failure aborts the collection

- **WHEN** the OpenCode Go documentation request fails, times out, or returns a non-success HTTP status
- **THEN** the collection fails and no snapshot file is written

### Requirement: Estimated Requests table is located structurally

The collector SHALL locate the **Estimated requests** section by its heading text and SHALL select the table associated with that section. It SHALL NOT rely on CSS class names, styling, or other visual selectors.

#### Scenario: Table is located under the expected heading

- **WHEN** the document contains an "Estimated requests" heading followed by a table
- **THEN** the collector selects that table for parsing
- **AND** tables belonging to other sections, such as pricing or privacy, are ignored

#### Scenario: Missing section aborts the collection

- **WHEN** the document has no recognizable "Estimated requests" section
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Missing table aborts the collection

- **WHEN** the "Estimated requests" section contains no table
- **THEN** the collection fails and no snapshot file is written

### Requirement: Estimated Requests columns are mapped by header text

The collector SHALL read the Estimated Requests header row and map each quota column by its header text: the model column, the 5-hour column, the weekly column, and the monthly column. Column mapping SHALL be order independent.

#### Scenario: Expected headers are mapped

- **WHEN** the header row contains a model header, a 5-hour quota header, a weekly quota header, and a monthly quota header
- **THEN** the collector maps each header to its corresponding quota period

#### Scenario: Column order varies

- **WHEN** the quota columns appear in a different order than the documented default
- **THEN** the collector still maps each column to the correct quota period based on its header text

#### Scenario: Required header missing aborts the collection

- **WHEN** the header row is missing the model header or any one of the three quota headers
- **THEN** the collection fails and no snapshot file is written

### Requirement: Endpoints table is located structurally

The collector SHALL locate the **Endpoints** section by its heading text and SHALL select the table associated with that section. It SHALL NOT rely on CSS class names, styling, or other visual selectors.

#### Scenario: Endpoints table is located under the expected heading

- **WHEN** the document contains an "Endpoints" heading followed by a table
- **THEN** the collector selects that table for parsing
- **AND** tables belonging to other sections, such as pricing, estimated requests, or privacy, are ignored

#### Scenario: Missing Endpoints section aborts the collection

- **WHEN** the document has no recognizable "Endpoints" section
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Missing Endpoints table aborts the collection

- **WHEN** the "Endpoints" section contains no table
- **THEN** the collection fails and no snapshot file is written

### Requirement: Endpoints columns are mapped by header text

The collector SHALL read the Endpoints header row and map the model column and the model ID column by their header text. Column mapping SHALL be order independent. The collector only requires the Model and Model ID columns; any remaining columns, such as Endpoint or AI SDK Package, SHALL be ignored and SHALL NOT be stored.

#### Scenario: Model and Model ID columns are mapped

- **WHEN** the Endpoints header row contains a model header and a model ID header
- **THEN** the collector maps each header to its corresponding field

#### Scenario: Remaining columns are ignored

- **WHEN** the Endpoints table also contains endpoint URL or AI SDK package columns
- **THEN** the collector reads only the Model and Model ID values and discards the rest

#### Scenario: Required Model column missing aborts the collection

- **WHEN** the Endpoints header row is missing the model header
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Required Model ID column missing aborts the collection

- **WHEN** the Endpoints header row is missing the model ID header
- **THEN** the collection fails and no snapshot file is written

### Requirement: Endpoints table integrity is enforced

The collector SHALL reject an Endpoints table that has no data rows, has malformed rows, or cannot provide a unique model name for each model ID and a unique model ID for each model name.

#### Scenario: Empty Endpoints table aborts the collection

- **WHEN** the Endpoints table has a valid header row but no data rows
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Malformed Endpoints rows abort the collection

- **WHEN** an Endpoints data row has a missing cell, a cell count that differs from the header, or cannot be read as a model name and model ID
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Duplicate model names abort the collection

- **WHEN** two Endpoints rows share the same model name
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Duplicate model IDs abort the collection

- **WHEN** two Endpoints rows share the same model ID
- **THEN** the collection fails and no snapshot file is written

### Requirement: Models are matched between the two tables

The collector SHALL match each model in the Estimated Requests table to exactly one entry in the Endpoints table using a deterministic key derived from the normalized model name. Normalization SHALL only reconcile harmless formatting differences: trimming surrounding whitespace and collapsing runs of whitespace, including equivalent HTML whitespace, to a single space. The collector SHALL NOT use fuzzy matching, similarity scoring, partial matching, or AI-based matching. The match SHALL be one-to-one.

#### Scenario: Model is matched by normalized name

- **WHEN** a model name in the Estimated Requests table equals a model name in the Endpoints table after normalization
- **THEN** the collector associates that Estimated Requests row with that Endpoints entry

#### Scenario: Whitespace differences do not prevent matching

- **WHEN** the two tables contain the same model name but with different surrounding or repeated whitespace
- **THEN** the names normalize to the same key and the models match

#### Scenario: Missing mapping aborts the collection

- **WHEN** a model exists in the Estimated Requests table but no Endpoints entry normalizes to the same name
- **THEN** the collection fails and no snapshot file is written
- **AND** the collector does not invent a model ID and does not silently omit the model

#### Scenario: Ambiguous mapping aborts the collection

- **WHEN** a model matches more than one Endpoints entry, or more than one Estimated Requests row matches the same Endpoints entry
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Extra Endpoints models are ignored

- **WHEN** the Endpoints table contains a model that does not appear in the Estimated Requests table
- **THEN** that model is ignored and the collection succeeds, because the snapshot represents models that have quota data

### Requirement: Model IDs come from the Endpoints table

The snapshot model id SHALL be the Model ID value from the matched Endpoints row, used verbatim. The collector SHALL NOT derive ids from display names, and SHALL NOT invent an id when the documentation provides none. If an id cannot be obtained for a model that has quota data, the collection SHALL fail.

#### Scenario: Model ID is taken verbatim from the Endpoints table

- **WHEN** an Estimated Requests model is matched to an Endpoints entry
- **THEN** the snapshot model id equals the Endpoints Model ID value exactly

#### Scenario: Model ID is not derived from the display name

- **WHEN** the Endpoints Model ID differs from any name-based transformation of the display name
- **THEN** the snapshot uses the Endpoints Model ID and not a derived value

### Requirement: Quota values are normalized to numbers

The collector SHALL normalize each numeric quota cell by trimming surrounding whitespace and removing thousands separators, producing a non-negative integer.

#### Scenario: Thousands separators are removed

- **WHEN** a quota cell contains a grouped number such as `150,400`
- **THEN** the collector stores the numeric value `150400`

#### Scenario: Surrounding whitespace is ignored

- **WHEN** a quota cell contains surrounding whitespace
- **THEN** the collector stores the trimmed numeric value

#### Scenario: Non-integer numeric values are rejected

- **WHEN** a quota cell contains a numeric value that is not a non-negative integer, such as `1.5` or `-3`
- **THEN** the collection fails and no snapshot file is written

### Requirement: Unlimited is represented explicitly

The collector SHALL recognize the source value `Unlimited` for any quota period and SHALL represent it in the snapshot as the literal string `unlimited`. It SHALL NOT use `Infinity`, `NaN`, or any JavaScript-specific numeric value.

#### Scenario: Unlimited value is represented

- **WHEN** a quota cell contains `Unlimited`
- **THEN** the collector stores the string `unlimited` for that quota period in the snapshot

#### Scenario: Unlimited is accepted in any quota period

- **WHEN** any one of the three quota cells contains `Unlimited`
- **THEN** the collection succeeds and only that quota period is represented as `unlimited`

### Requirement: Unsupported quota values cause failure

The collector SHALL treat a missing, empty, or otherwise unrecognized quota cell as an error rather than a representable value.

#### Scenario: Missing or empty cell aborts the collection

- **WHEN** a data row has a missing or empty quota cell
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Unrecognized value aborts the collection

- **WHEN** a quota cell contains text that is neither a non-negative integer nor `Unlimited`
- **THEN** the collection fails and no snapshot file is written

#### Scenario: A dash or placeholder aborts the collection

- **WHEN** a quota cell contains a placeholder such as `-`, `N/A`, or `TBD`
- **THEN** the collection fails and no snapshot file is written

### Requirement: Empty and malformed Estimated Requests tables cause failure

The collector SHALL reject an Estimated Requests table that has no data rows or whose structure is inconsistent.

#### Scenario: Header-only table aborts the collection

- **WHEN** the Estimated Requests table has a valid header row but no data rows
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Row with wrong cell count aborts the collection

- **WHEN** an Estimated Requests data row has fewer or more cells than the header row
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Malformed table aborts the collection

- **WHEN** the Estimated Requests table structure cannot be interpreted as a header row followed by data rows
- **THEN** the collection fails and no snapshot file is written

### Requirement: Snapshot conforms to the snapshot schema

The collector SHALL build a snapshot that conforms to the project snapshot schema and SHALL validate it before persistence. The snapshot SHALL contain a `schemaVersion`, a `source` object describing the provider, plan, and page URL, a UTC `scrapedAt` timestamp in ISO 8601 format, and a `models` array of model entries. Each model entry SHALL contain `id`, `name`, and `estimatedRequests` with `fiveHour`, `weekly`, and `monthly` values, where `id` is the Model ID from the Endpoints table. Quota values SHALL be either a non-negative integer or the string `unlimited`. The snapshot SHALL contain state only, SHALL NOT contain any change or diff information, and SHALL NOT store endpoint URLs, AI SDK packages, or other endpoint metadata.

#### Scenario: Valid snapshot is accepted

- **WHEN** the parsed and matched data satisfies the snapshot schema
- **THEN** validation passes and the snapshot is eligible for persistence

#### Scenario: Snapshot metadata is populated

- **WHEN** a snapshot is built
- **THEN** `schemaVersion` is set, `source` identifies the provider `opencode`, the plan `go`, and the canonical page URL without a fragment, and `scrapedAt` is a UTC ISO 8601 timestamp

#### Scenario: Schema-invalid snapshot is rejected

- **WHEN** the assembled snapshot does not satisfy the snapshot schema
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Snapshot contains no change or endpoint metadata

- **WHEN** a snapshot is built
- **THEN** it contains no diff, change, previous-value, or report fields
- **AND** it contains no endpoint URL, AI SDK package, or other endpoint metadata

### Requirement: Snapshots are persisted immutably

The collector SHALL write a validated snapshot as JSON to `data/snapshots/<timestamp>.json`, where `<timestamp>` is derived from `scrapedAt` in UTC. The collector SHALL NOT overwrite or modify an existing snapshot file.

#### Scenario: Validated snapshot is written

- **WHEN** the collection succeeds and no file exists at the target path
- **THEN** the snapshot is written as JSON to `data/snapshots/<timestamp>.json`

#### Scenario: Existing snapshot is preserved

- **WHEN** a file already exists at the target snapshot path
- **THEN** the collector does not modify it
- **AND** the collection fails rather than overwriting historical data

#### Scenario: No partial file on failure

- **WHEN** any stage of the collection fails
- **THEN** no new or partially written snapshot file remains in `data/snapshots/`

### Requirement: Collector stays independent from diff and API

The collector SHALL NOT contain diff, change detection, or API concerns. It SHALL expose collection as a unit independent of any HTTP server or comparison with previous snapshots.

#### Scenario: Collector does not compute changes

- **WHEN** the collector runs
- **THEN** it does not read previous snapshots, compute differences, or emit change reports

#### Scenario: Collector does not serve HTTP

- **WHEN** the collector is used
- **THEN** it does not register routes or depend on the API runtime

### Requirement: Pricing tables are located structurally

The collector SHALL locate the OpenCode Go **Pricing** tables by their distinguishing header set, a Model column plus Input, Output, Cached Read, Cached Write, and Monthly limit columns, and SHALL NOT rely on the section heading text, CSS class names, styling, or other visual selectors. The collector SHALL find two pricing tables on the page, one for the Go plan and one for the Go Plus plan.

#### Scenario: Both plan pricing tables are located

- **WHEN** the document contains a Go pricing table and a Go Plus pricing table
- **THEN** the collector selects both tables, one per plan

#### Scenario: Tables are identified by headers, not heading text

- **WHEN** the collector looks for the pricing tables
- **THEN** it selects tables whose header row contains the pricing columns, regardless of the heading text above them

#### Scenario: Missing pricing table aborts the collection

- **WHEN** the document does not contain both plan pricing tables
- **THEN** the collection fails and no snapshot file is written

### Requirement: Pricing rows are associated with a plan and a variant

The collector SHALL associate each pricing table with its plan, `go` or `go-plus`. For each row it SHALL derive a variant from the model cell: `default` when the model name has no qualifier, otherwise a normalized key derived from the qualifier (for example `off-peak`, `peak`, or a token-tier key such as `le-256k`). It SHALL preserve a human-readable variant label from the source. Column mapping SHALL be order independent and driven by header text.

#### Scenario: Plan is derived per table

- **WHEN** a pricing table belongs to the Go Plus plan
- **THEN** every row from that table is associated with plan `go-plus`

#### Scenario: Variant is derived from a qualifier

- **WHEN** a pricing row's model cell contains a qualifier such as `(Off-Peak)` or `(≤ 256K tokens)`
- **THEN** the collector stores a normalized variant key and the source label for that row

#### Scenario: Rows without a qualifier are default

- **WHEN** a pricing row's model cell has no qualifier
- **THEN** the collector stores the variant key `default`

#### Scenario: Column order varies

- **WHEN** the pricing columns appear in a different order than the documented default
- **THEN** the collector still maps each column to the correct field based on its header text

#### Scenario: Required pricing header missing aborts the collection

- **WHEN** a pricing table is missing the model header, the input header, the output header, or the monthly limit header
- **THEN** the collection fails and no snapshot file is written

### Requirement: Pricing model names are matched to snapshot models

For each pricing row the collector SHALL derive a base model name by removing the variant qualifier and normalizing whitespace, and SHALL match it to exactly one snapshot model using the same normalized name key used by the other tables. Multiple pricing rows may map to the same model for the same plan as distinct variants. A pricing row whose base name matches no model SHALL abort the collection. A snapshot model with no pricing row for a plan SHALL abort the collection.

#### Scenario: Base name ignores the variant qualifier

- **WHEN** a pricing row is labeled `Qwen3.7 Plus (≤ 256K tokens)`
- **THEN** the collector matches it to the model named `Qwen3.7 Plus`

#### Scenario: Multiple variants map to one model

- **WHEN** a model has a peak row and an off-peak row in the same plan
- **THEN** the collector stores both as separate pricing entries for that model and plan

#### Scenario: Unknown pricing model aborts the collection

- **WHEN** a pricing row's base name matches no snapshot model
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Model without pricing for a plan aborts the collection

- **WHEN** a snapshot model has no pricing row for one of the two plans
- **THEN** the collection fails and no snapshot file is written

### Requirement: Pricing values are normalized

The collector SHALL normalize each price cell to a non-negative number of USD per 1M tokens, mapping `Free` to `0`. An absent optional price, shown as `-`, SHALL be represented as `null`. The monthly limit SHALL be normalized to an object with `amount` and currency `USD`, or the literal `unlimited`. A missing, empty, or unrecognized price or limit cell SHALL abort the collection.

#### Scenario: Free prices become zero

- **WHEN** a price cell contains `Free`
- **THEN** the collector stores the numeric price `0`

#### Scenario: Absent optional price becomes null

- **WHEN** a cached read or cached write cell contains `-`
- **THEN** the collector stores `null` for that price

#### Scenario: Monthly limit is normalized with currency

- **WHEN** a monthly limit cell contains `$60`
- **THEN** the collector stores an amount of `60` with currency `USD`

#### Scenario: Unlimited monthly limit is represented

- **WHEN** a monthly limit cell contains `Unlimited`
- **THEN** the collector stores the literal `unlimited` for that limit

#### Scenario: Unrecognized price or limit aborts the collection

- **WHEN** a price or monthly limit cell is missing, empty, or cannot be interpreted
- **THEN** the collection fails and no snapshot file is written

### Requirement: Snapshots include optional Go pricing

Each snapshot model entry SHALL include an optional `pricing` array. Each pricing entry SHALL contain `plan`, `variant`, `variantLabel`, `input`, `output`, `cachedRead`, `cachedWrite`, and `monthlyLimit`. The snapshot SHALL validate against the snapshot schema before persistence. `pricing` SHALL be additive: the existing required model fields, the existing `schemaVersion`, and the existing `source` object SHALL be unchanged, and historical snapshots without pricing SHALL remain valid.

#### Scenario: Pricing is attached to each model

- **WHEN** a snapshot is built
- **THEN** each model entry contains pricing for both plans as one or more variant entries

#### Scenario: Schema-invalid pricing is rejected

- **WHEN** the assembled pricing does not satisfy the snapshot schema
- **THEN** the collection fails and no snapshot file is written

#### Scenario: Historical snapshots without pricing remain valid

- **WHEN** a snapshot that predates this change is loaded
- **THEN** it remains valid even though it has no `pricing` field

#### Scenario: Pricing does not store endpoint metadata

- **WHEN** a snapshot is built
- **THEN** the pricing entries contain no endpoint URL, AI SDK package, or pricing-table column beyond the documented price and monthly-limit fields
