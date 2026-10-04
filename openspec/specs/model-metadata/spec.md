# model-metadata Specification

## Purpose

Enriches committed snapshots with model metadata from the models.dev catalog so the review can report context window, output limit, modalities, and capabilities as validated facts instead of undisclosed gaps.

## Requirements

### Requirement: Metadata is fetched from models.dev

The enrichment stage SHALL fetch the models.dev model catalog over HTTPS, select the `opencode-go` provider, and treat the fetched document as untrusted input. A fetch failure, a non-success status, or a catalog without the `opencode-go` provider SHALL abort the enrichment and no snapshot with metadata SHALL be written.

#### Scenario: Catalog is fetched and the provider is selected

- **WHEN** the enrichment stage runs and the catalog responds successfully
- **THEN** it selects the `opencode-go` provider and reads that provider's models

#### Scenario: Fetch failure aborts the enrichment

- **WHEN** the catalog request fails, times out, or returns a non-success status
- **THEN** the enrichment fails and no snapshot with metadata is written

#### Scenario: Missing provider aborts the enrichment

- **WHEN** the catalog does not contain the `opencode-go` provider
- **THEN** the enrichment fails and no snapshot with metadata is written

### Requirement: Metadata is matched by exact model id

Each snapshot model SHALL be matched to the models.dev entry whose id equals the snapshot model id within the `opencode-go` provider. Matching SHALL be exact and case-sensitive. The enrichment SHALL NOT use fuzzy matching, similarity scoring, partial matching, or name-based matching.

#### Scenario: Exact id match attaches metadata

- **WHEN** a snapshot model id equals a models.dev `opencode-go` model id
- **THEN** the enrichment attaches that entry's selected metadata to the model

#### Scenario: No fuzzy matching

- **WHEN** a snapshot model id does not equal any models.dev `opencode-go` model id
- **THEN** the enrichment does not attach metadata based on a similar name or id

### Requirement: Only selected metadata fields are stored

The metadata stored on a model SHALL contain only the configured fields: context and output limits, input and output modalities, capability flags for attachment, reasoning, tool call, structured output, temperature, and open weights, plus family, knowledge cutoff, release date, and the canonical model id. It SHALL NOT store provider endpoints, API base URLs, environment variable names, package names, or free-text descriptions.

#### Scenario: Selected fields are stored

- **WHEN** a model's metadata is attached
- **THEN** it contains the context and output limits and the other selected fields that the catalog provides

#### Scenario: Provider and endpoint fields are excluded

- **WHEN** a model's metadata is attached
- **THEN** it contains no provider endpoint, API base URL, environment variable name, package name, or description

### Requirement: Metadata is validated before persistence

Each metadata object SHALL satisfy the metadata schema before persistence. The context and output limits SHALL be non-negative integers when metadata is present. A selected field with an invalid type or value SHALL abort the enrichment and no snapshot with metadata SHALL be written.

#### Scenario: Valid metadata is accepted

- **WHEN** a selected metadata object satisfies the metadata schema
- **THEN** it is eligible to be attached and persisted

#### Scenario: Invalid metadata aborts the enrichment

- **WHEN** a selected metadata field has an invalid type or value, such as a negative or non-numeric limit
- **THEN** the enrichment fails and no snapshot with metadata is written

### Requirement: A model without a catalog entry is omitted, not invented

When a snapshot model has no matching models.dev entry, the enrichment SHALL omit `metadata` for that model and SHALL NOT invent or copy values from another model. The collection SHALL still succeed and persist a valid snapshot, and the absence of metadata SHALL mean the metadata was not collected.

#### Scenario: Missing entry omits metadata

- **WHEN** a snapshot model has no models.dev `opencode-go` entry
- **THEN** that model is persisted without a `metadata` object

#### Scenario: Missing entry does not abort the collection

- **WHEN** at least one snapshot model has metadata and at least one does not
- **THEN** the collection succeeds and persists the valid snapshot

#### Scenario: Values are not invented

- **WHEN** a model has no catalog entry
- **THEN** the enrichment does not supply an estimated or remembered context window, output limit, or capability

### Requirement: Snapshots include optional model metadata

Each snapshot model entry SHALL include an optional `metadata` object. `metadata` SHALL be additive: the existing required model fields, the existing `schemaVersion`, and the existing `source` object SHALL be unchanged, and historical snapshots without metadata SHALL remain valid.

#### Scenario: Metadata is attached to matched models

- **WHEN** a snapshot is built and models match the catalog
- **THEN** those model entries contain a `metadata` object

#### Scenario: Historical snapshots without metadata remain valid

- **WHEN** a snapshot that predates this change is loaded
- **THEN** it remains valid even though it has no `metadata` field

#### Scenario: Metadata does not change the schema version

- **WHEN** a snapshot with metadata is built
- **THEN** its `schemaVersion` is unchanged and the existing required fields remain present

### Requirement: Enrichment tests are deterministic and offline

Tests for the enrichment SHALL use local fixtures for the models.dev catalog and SHALL NOT depend on the live models.dev service. The live catalog check SHALL remain a separate opt-in test.

#### Scenario: Normal suite stays offline

- **WHEN** the normal test suite runs
- **THEN** the enrichment tests pass without contacting models.dev

#### Scenario: Live check remains opt-in

- **WHEN** the normal test suite runs
- **THEN** the live models.dev check is skipped unless explicitly enabled
