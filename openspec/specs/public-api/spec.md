# public-api Specification

## Purpose

Exposes the latest validated OpenCode Go quota snapshot and the latest generated change report over a small, read-only HTTP API, without performing collection, scraping, parsing, normalization, or diff calculation.

## Requirements

### Requirement: Current snapshot is exposed over HTTP

The API SHALL expose `GET /api/v1/current`, which returns the latest validated snapshot. The response body SHALL be the existing snapshot structure produced by the collector and SHALL NOT be transformed into an API-specific representation. The response body SHALL contain the snapshot's `schemaVersion`, `source`, `scrapedAt`, and `models` fields exactly as stored.

#### Scenario: Current snapshot is returned

- **WHEN** a client requests `GET /api/v1/current` and a valid latest snapshot exists
- **THEN** the API returns HTTP `200` with the latest snapshot as JSON

#### Scenario: Snapshot is not transformed

- **WHEN** a client requests `GET /api/v1/current`
- **THEN** the response body matches the stored snapshot structure and contains no added, renamed, or omitted fields beyond the stored snapshot

### Requirement: Latest change report is exposed over HTTP

The API SHALL expose `GET /api/v1/changes`, which returns the latest generated change report. The response body SHALL be the existing change-report structure produced by the diff stage and SHALL NOT be recomputed by the API. The response body SHALL contain the report's `schemaVersion`, `from`, `to`, and `changes` fields exactly as stored.

#### Scenario: Change report is returned

- **WHEN** a client requests `GET /api/v1/changes` and a valid latest change report exists
- **THEN** the API returns HTTP `200` with the latest change report as JSON

#### Scenario: Diff is not recomputed

- **WHEN** a client requests `GET /api/v1/changes`
- **THEN** the API returns the stored change report and performs no comparison of snapshots and no diff calculation

### Requirement: The API is read-only

The API SHALL provide only the two read endpoints. It SHALL NOT provide `POST`, `PUT`, `PATCH`, or `DELETE` handlers for any route, and SHALL NOT provide `/api/v1/models`, `/api/v1/history`, or `/api/v1/stats`.

#### Scenario: Unsupported methods are not handled

- **WHEN** a client sends `POST`, `PUT`, `PATCH`, or `DELETE` to any API route
- **THEN** the API does not mutate any data and returns a non-success response

#### Scenario: Out-of-scope routes are not implemented

- **WHEN** a client requests `/api/v1/models`, `/api/v1/history`, or `/api/v1/stats`
- **THEN** the API returns a not-found response

### Requirement: Latest data is resolved without scanning or diffing

The API SHALL resolve the latest snapshot and latest change report through a deterministic generated pointer or index, and SHALL NOT scan arbitrary historical files at request time, SHALL NOT determine which snapshot is newest at request time, and SHALL NOT execute collection or diff logic.

#### Scenario: No historical scanning at request time

- **WHEN** a client requests a read endpoint
- **THEN** the API reads the latest data through the generated pointer or index and does not enumerate or compare historical snapshot or report files

#### Scenario: No newest-selection at request time

- **WHEN** a client requests a read endpoint
- **THEN** the API does not sort or compare historical timestamps to decide which file to serve

### Requirement: The Worker performs no scraping, parsing, or diff logic

The API SHALL serve only already-generated, already-validated data. It SHALL NOT fetch the OpenCode documentation, SHALL NOT call any OpenCode endpoint at request time, and SHALL NOT contain collection, parsing, normalization, snapshot-generation, or diff logic.

#### Scenario: No external fetch at request time

- **WHEN** a client requests a read endpoint
- **THEN** the API performs no network request to OpenCode or any external service

#### Scenario: No business logic in the Worker

- **WHEN** the API is implemented
- **THEN** it contains no scraping, HTML parsing, normalization, snapshot creation, or diff calculation code

### Requirement: The data source is the generated project data

The API's source of truth SHALL be the generated project data under `data/snapshots/` and `data/changes/`, and SHALL NOT be a database or an external service.

#### Scenario: Generated data is used

- **WHEN** the API serves current or changes data
- **THEN** it serves data originating from the generated project data and does not depend on a database or external service

### Requirement: Successful responses return HTTP 200

WHEN the requested data is available and valid, the API SHALL return HTTP `200` for `GET /api/v1/current` and `GET /api/v1/changes`.

#### Scenario: Current returns 200

- **WHEN** the latest snapshot is available and valid
- **THEN** `GET /api/v1/current` returns HTTP `200`

#### Scenario: Changes returns 200

- **WHEN** the latest change report is available and valid
- **THEN** `GET /api/v1/changes` returns HTTP `200`

### Requirement: Unavailable data returns a 5xx response

WHEN the expected latest snapshot or latest change report cannot be resolved or loaded, the API SHALL return an appropriate `5xx` response and SHALL NOT fabricate an empty snapshot or empty change report.

#### Scenario: Missing current data returns 5xx

- **WHEN** the latest snapshot cannot be resolved or loaded
- **THEN** `GET /api/v1/current` returns an appropriate `5xx` status and does not return an empty `models` array as a fabricated snapshot

#### Scenario: Missing changes data returns 5xx

- **WHEN** the latest change report cannot be resolved or loaded
- **THEN** `GET /api/v1/changes` returns an appropriate `5xx` status and does not return an empty `changes` array as a fabricated report

### Requirement: Invalid stored data returns a 5xx response

WHEN stored JSON fails schema validation, the API SHALL treat it as a server-side data integrity error, SHALL return an appropriate `5xx` response, and SHALL NOT serve the invalid data.

#### Scenario: Invalid snapshot returns 5xx

- **WHEN** the resolved latest snapshot does not satisfy the snapshot schema
- **THEN** `GET /api/v1/current` returns an appropriate `5xx` status and does not serve the invalid snapshot

#### Scenario: Invalid change report returns 5xx

- **WHEN** the resolved latest change report does not satisfy the change-report schema
- **THEN** `GET /api/v1/changes` returns an appropriate `5xx` status and does not serve the invalid report

### Requirement: Stored data is validated before being returned

The API SHALL validate the resolved latest snapshot against the existing snapshot schema and the resolved latest change report against the existing change-report schema before returning them.

#### Scenario: Snapshot is validated

- **WHEN** the API serves `GET /api/v1/current`
- **THEN** the snapshot is validated against the snapshot schema before being returned

#### Scenario: Change report is validated

- **WHEN** the API serves `GET /api/v1/changes`
- **THEN** the change report is validated against the change-report schema before being returned

### Requirement: Existing schemas are reused, not duplicated

The API SHALL reuse the existing snapshot and change-report schemas and SHALL NOT define duplicate or alternative schemas for the same data.

#### Scenario: Snapshot schema is reused

- **WHEN** the API validates a snapshot
- **THEN** it uses the project's existing snapshot schema and introduces no alternative snapshot schema

#### Scenario: Change-report schema is reused

- **WHEN** the API validates a change report
- **THEN** it uses the project's existing change-report schema and introduces no alternative change-report schema

### Requirement: Error responses use a consistent JSON shape

Error responses SHALL be small JSON objects with a single `error` field whose value is a short human-readable message.

#### Scenario: Error body shape is consistent

- **WHEN** the API returns an error response
- **THEN** the body is a JSON object with an `error` string field and no other required fields

### Requirement: Error responses do not leak internal details

Error responses SHALL NOT expose internal filesystem paths, stack traces, or implementation details.

#### Scenario: No internal paths in errors

- **WHEN** the API returns an error response
- **THEN** the message contains no filesystem path, stack trace, or internal implementation detail

### Requirement: Caching headers are set on read endpoints

The read-only endpoints SHALL include appropriate HTTP caching headers so that downstream HTTP and Cloudflare caching mechanisms can reuse responses. The API SHALL NOT implement an application-level cache or cache database, and SHALL NOT make cache invalidation part of its business logic.

#### Scenario: Success responses include caching headers

- **WHEN** a read endpoint returns a success response
- **THEN** the response includes a `Cache-Control` header indicating the response may be cached

#### Scenario: No application-level cache

- **WHEN** the API is implemented
- **THEN** it introduces no in-memory cache store, cache database, or cache-invalidation business logic

### Requirement: A minimal health endpoint is provided

The API SHALL expose a trivial health endpoint that is separate from the versioned API, and SHALL NOT introduce monitoring, authentication, or complex health-check infrastructure.

#### Scenario: Health endpoint responds

- **WHEN** a client requests the health endpoint
- **THEN** the API returns HTTP `200` with a small, fixed JSON body

#### Scenario: Health is separate from the versioned API

- **WHEN** the API is implemented
- **THEN** the health endpoint is not part of the `/api/v1` route namespace

### Requirement: API tests are deterministic and offline

API tests SHALL verify endpoint behavior using local fixture data and Hono's request utilities, and SHALL NOT depend on the live OpenCode website or any network service.

#### Scenario: Normal suite stays offline

- **WHEN** the normal test suite runs
- **THEN** the API tests pass without contacting OpenCode or any network service

#### Scenario: Behavior is covered

- **WHEN** the API tests run
- **THEN** they cover a `200` with a valid snapshot, a `200` with a valid change report, a `5xx` for missing current data, a `5xx` for missing changes data, a `5xx` for an invalid snapshot, a `5xx` for an invalid change report, the defined JSON error shape, and the absence of scraping or diff logic in the API
