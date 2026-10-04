## Purpose

Provides an OpenCode skill that reads the committed OpenCode Sentry data over raw GitHub and gives the user's agent a repeatable way to report current model quotas and recent quota changes, with the agent, not the pipeline, responsible for any recommendation.

## ADDED Requirements

### Requirement: A global skill reads the data

The project SHALL provide an OpenCode skill that is installable globally and instructs the agent how to read the latest snapshot and change report. The skill's canonical copy SHALL be versioned in the repository and a copy SHALL be installed under the global OpenCode skills directory.

#### Scenario: Skill is available globally

- **WHEN** the skill is installed
- **THEN** it is discoverable from the global OpenCode skills directory with a valid name and description

#### Scenario: Skill is versioned

- **WHEN** the repository is inspected
- **THEN** the canonical skill file exists in the repository

### Requirement: The raw data contract is stable and documented

The skill SHALL resolve data through a stable raw GitHub contract: a base URL, a `data/latest.json` pointer with `snapshot` and `changes` fields, and the referenced files relative to the data directory.

#### Scenario: Pointer is used

- **WHEN** the skill fetches the latest data
- **THEN** it fetches `data/latest.json` first and then the snapshot and change report it references

#### Scenario: Contract is documented

- **WHEN** a maintainer reads the skill or project documentation
- **THEN** the base URL and pointer shape are documented

### Requirement: Current quotas are reported as facts

The skill SHALL report the current models and their `estimatedRequests` for the five-hour, weekly, and monthly periods, using the values from the snapshot without inventing or transforming them.

#### Scenario: Current quotas are listed

- **WHEN** the user asks for current quotas
- **THEN** the skill reports each model's five-hour, weekly, and monthly estimated requests from the latest snapshot

#### Scenario: Unlimited is represented faithfully

- **WHEN** a model's quota is `"unlimited"`
- **THEN** the skill reports it as unlimited rather than as a number

### Requirement: Recent changes are reported as facts

The skill SHALL report the latest change report's `model_added`, `model_removed`, and `quota_changed` entries, including previous and current values for quota changes.

#### Scenario: Changes are listed

- **WHEN** the user asks what changed
- **THEN** the skill reports the latest change report's entries with their model and, for quota changes, the previous and current values

#### Scenario: No fabricated changes

- **WHEN** the latest change report contains no entries
- **THEN** the skill reports that no changes were detected rather than inventing changes

### Requirement: Freshness is always surfaced

The skill SHALL report the snapshot's `scrapedAt` and the change report's `from` and `to` timestamps, and SHALL NOT present the data as live.

#### Scenario: Timestamps are shown

- **WHEN** the skill reports data
- **THEN** it includes the snapshot `scrapedAt` and the change report `from` and `to`

### Requirement: Recommendations are made by the agent, not the pipeline

The skill MAY compare models by `estimatedRequests` as a cost-efficiency proxy and offer a recommendation, but the pipeline and its generated data SHALL remain facts only. The skill SHALL state that `estimatedRequests` is a quota, not a currency price, because no price data is collected.

#### Scenario: Ranking uses quota as a proxy

- **WHEN** the user asks which model is best for quality/cost
- **THEN** the skill compares models by estimated requests, labels it a proxy, and makes the recommendation in the agent

#### Scenario: No price is claimed

- **WHEN** the skill discusses cost
- **THEN** it states that only quota data is available and no currency price is collected

### Requirement: Missing or invalid data is handled loudly

When the raw data cannot be fetched or fails validation, the skill SHALL report the failure and SHALL NOT fabricate or guess values. A local-clone fallback SHALL be documented for offline or private use.

#### Scenario: Fetch failure is reported

- **WHEN** the raw data cannot be fetched or is malformed
- **THEN** the skill reports the failure instead of guessing

#### Scenario: Fallback is documented

- **WHEN** raw access is unavailable
- **THEN** the skill documents reading the data from a local clone

### Requirement: The integration introduces no server or dependency

The integration SHALL NOT add an HTTP server, endpoint, authentication, database, or new runtime dependency.

#### Scenario: No service is added

- **WHEN** the integration is implemented
- **THEN** only skill and documentation files are added and no service, endpoint, secret, or dependency is introduced
