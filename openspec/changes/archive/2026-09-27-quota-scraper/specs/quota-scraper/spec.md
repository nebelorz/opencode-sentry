## Purpose

Collects the OpenCode Go **Estimated Requests** and **Endpoints** tables from the official documentation, matches models between them by normalized name to obtain the stable model IDs, normalizes and validates the result, and persists an immutable, machine-readable JSON snapshot. It is the first stage of the pipeline and publishes data only, never recommendations.

## ADDED Requirements

### Requirement: Source is fetched over HTTPS

The collector SHALL fetch the official OpenCode Go documentation page from `https://opencode.ai/v2/docs/console/go` exactly once per collection run as its data source. It SHALL extract data from two tables in that single document: the Estimated Requests table for model names and quotas, and the Endpoints table for model names and model IDs. It SHALL use the page's semantic content only and SHALL treat the fetched document as untrusted input.

#### Scenario: Source is fetched successfully

- **WHEN** the collector runs and the source responds successfully with an HTML document
- **THEN** the collector proceeds to parse that document

#### Scenario: Both tables are read from one document

- **WHEN** the collector collects a snapshot
- **THEN** it uses a single fetched document to read both the Estimated Requests table and the Endpoints table

#### Scenario: Fetch failure aborts the collection

- **WHEN** the source request fails, times out, or returns a non-success HTTP status
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
