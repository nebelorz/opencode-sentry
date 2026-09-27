## Purpose

Provides a minimal, on-demand executable entry point that runs the existing OpenCode Go collection pipeline against the live documentation, reports the generated snapshot, and fails safely with a non-zero exit status when collection cannot complete.

## ADDED Requirements

### Requirement: Collection is exposed as a package script

The project SHALL expose a `collect` package script such that `pnpm collect` runs the collection pipeline against the live source. Running `pnpm collect` SHALL NOT execute the test suite.

#### Scenario: Collect script runs the pipeline

- **WHEN** a user runs `pnpm collect`
- **THEN** the collection pipeline is executed against the live OpenCode documentation

#### Scenario: Collect script does not run tests

- **WHEN** a user runs `pnpm collect`
- **THEN** the test suite is not executed

### Requirement: The entry point reuses the existing collector

The entry point SHALL orchestrate the existing collection pipeline and SHALL NOT reimplement or duplicate fetching, parsing, normalization, matching, snapshot creation, validation, or persistence. The entry point SHALL contain no collection business logic beyond invocation and result or error reporting.

#### Scenario: Existing pipeline is invoked

- **WHEN** the entry point runs
- **THEN** collection is performed by the existing collector logic

#### Scenario: Collection logic is not duplicated

- **WHEN** the entry point is implemented
- **THEN** it contains no fetching, parsing, normalization, matching, validation, or persistence logic of its own

### Requirement: Successful collection persists a validated snapshot

WHEN collection succeeds, the entry point SHALL persist the validated snapshot under `data/snapshots/` using the collector's existing filesystem-safe UTC timestamp filename convention, SHALL exit with a success status, and SHALL print a concise message identifying the generated snapshot file.

#### Scenario: Snapshot file is written

- **WHEN** collection succeeds
- **THEN** a validated snapshot is written under `data/snapshots/` at the path produced by the existing filename convention

#### Scenario: Success message identifies the snapshot

- **WHEN** collection succeeds
- **THEN** the command prints a concise message that identifies the generated snapshot file

#### Scenario: Process exits successfully

- **WHEN** collection succeeds
- **THEN** the process exits with a zero exit status

### Requirement: Failures fail loudly without publishing data

WHEN any collection stage fails, the entry point SHALL exit with a non-zero status, SHALL write the error to stderr, SHALL NOT leave a new, partial, or invalid snapshot behind, and SHALL NOT modify existing snapshots. The entry point SHALL NOT swallow errors.

#### Scenario: Collector failure exits non-zero

- **WHEN** the collector throws an error
- **THEN** the process exits with a non-zero status

#### Scenario: Error is surfaced

- **WHEN** collection fails
- **THEN** the error is written to stderr and is not swallowed

#### Scenario: No partial snapshot on failure

- **WHEN** any collection stage fails
- **THEN** no new or partial snapshot file remains under `data/snapshots/`

#### Scenario: Existing snapshots are untouched on failure

- **WHEN** collection fails
- **THEN** existing snapshot files are not modified

### Requirement: Existing snapshots are never overwritten

The entry point SHALL preserve the collector's immutable persistence behavior. WHEN a snapshot already exists at the generated timestamp path, the entry point SHALL fail with a non-zero exit status and SHALL NOT overwrite the existing file. The entry point SHALL NOT provide any overwrite or force option.

#### Scenario: Existing snapshot is preserved

- **WHEN** a snapshot already exists at the generated path and collection runs
- **THEN** the existing file is not overwritten
- **AND** the process exits with a non-zero status

#### Scenario: No force or overwrite option

- **WHEN** `pnpm collect` is run
- **THEN** it exposes no overwrite or force option that could replace an existing snapshot

### Requirement: The entry point uses production defaults only

The entry point SHALL use the collector's existing production behavior by default. It SHALL NOT require or introduce additional configuration, CLI arguments, or configuration files, and SHALL NOT make the test-only `LIVE_SOURCE` switch part of its contract.

#### Scenario: Live source is used by default

- **WHEN** `pnpm collect` is run without extra configuration
- **THEN** the collector runs against the official OpenCode documentation with its production defaults

#### Scenario: Test-only switch is not required

- **WHEN** `pnpm collect` is run
- **THEN** the `LIVE_SOURCE` environment variable is neither required nor used to select behavior

#### Scenario: No CLI arguments or configuration are needed

- **WHEN** `pnpm collect` is run
- **THEN** no CLI arguments, flags, or configuration files are needed

### Requirement: The entry point runs without a build step or new dependency

Running `pnpm collect` SHALL execute the TypeScript entry point directly on the installed Node runtime without a prior build step and without adding a new runtime dependency.

#### Scenario: No build step is required

- **WHEN** a user runs `pnpm collect` on a fresh install
- **THEN** the entry point executes without a preceding build or compile step

#### Scenario: No new dependency is introduced

- **WHEN** the entry point is added
- **THEN** no new runtime dependency is required to execute it

### Requirement: Entry point tests are deterministic and offline

Tests for the entry point SHALL verify success and failure behavior without requiring network access to the live OpenCode documentation. The opt-in live-source integration test SHALL remain separate from the normal test suite.

#### Scenario: Normal suite stays offline

- **WHEN** the normal test suite runs
- **THEN** entry point tests pass without contacting the live OpenCode documentation

#### Scenario: Live integration test remains opt-in

- **WHEN** the normal test suite runs
- **THEN** the live-source integration test is skipped unless explicitly enabled
