## ADDED Requirements

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
