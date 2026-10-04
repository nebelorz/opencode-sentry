## MODIFIED Requirements

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
