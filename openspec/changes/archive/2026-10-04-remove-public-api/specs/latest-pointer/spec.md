## Purpose

Generates a small, stable `data/latest.json` pointer that identifies the newest snapshot and the newest change report, so downstream consumers such as an OpenCode skill can resolve the latest data without listing directories or running a server.

## ADDED Requirements

### Requirement: A latest pointer is generated

The project SHALL generate `data/latest.json` containing the relative paths to the newest snapshot and the newest change report. The pointer SHALL be the stable entry point for consumers that cannot enumerate the `data/` directories.

#### Scenario: Pointer is written

- **WHEN** the latest pointer command runs against a populated `data/` tree
- **THEN** `data/latest.json` is written with a `snapshot` field and a `changes` field holding paths relative to `data/`

#### Scenario: Pointer is stable

- **WHEN** consumers read `data/latest.json`
- **THEN** they can resolve both referenced files without listing or sorting `data/snapshots/` or `data/changes/`

### Requirement: The pointer selects the newest files

The pointer command SHALL select the newest snapshot from `data/snapshots/*.json` and the newest change report from `data/changes/*.json` by lexicographic filename order, and SHALL NOT select them at request time or by guessing.

#### Scenario: Newest snapshot and report are selected

- **WHEN** multiple snapshots and change reports exist
- **THEN** the pointer references the lexicographically greatest filename in each directory

#### Scenario: Selection is deterministic

- **WHEN** the command runs repeatedly over unchanged data
- **THEN** it produces the same pointer

### Requirement: The pointer command validates its inputs

Before writing the pointer, the command SHALL read and validate the selected snapshot against the existing snapshot schema and the selected change report against the existing change-report schema. It SHALL reuse the existing schemas and SHALL NOT define alternative schemas.

#### Scenario: Valid data is required

- **WHEN** the selected files satisfy their schemas
- **THEN** the pointer is written

#### Scenario: Invalid data aborts

- **WHEN** a selected file is missing, unreadable, malformed JSON, or schema-invalid
- **THEN** the command exits non-zero, writes an error, and does not write a partial pointer

### Requirement: The pointer command covers an empty or missing data tree

The command SHALL fail with a non-zero exit status when `data/snapshots/` or `data/changes/` is missing or contains no JSON file, and SHALL NOT fabricate an empty pointer.

#### Scenario: Missing directory fails

- **WHEN** `data/snapshots/` or `data/changes/` does not exist
- **THEN** the command exits non-zero and writes an error

#### Scenario: Empty directory fails

- **WHEN** `data/snapshots/` or `data/changes/` has no `*.json` file
- **THEN** the command exits non-zero and writes an error

### Requirement: The pointer command performs no HTTP or API work

The pointer command SHALL NOT start a server, import Worker or HTTP code, or fetch external data. It SHALL operate only on the local `data/` tree.

#### Scenario: No server or network is involved

- **WHEN** the pointer command runs
- **THEN** it reads and writes local files only and performs no network request

### Requirement: The pointer command is exposed as a package script

The project SHALL expose a `latest` package script that runs the pointer command directly with the installed Node runtime, without a build step and without adding a runtime dependency.

#### Scenario: Latest script runs the command

- **WHEN** a user runs `pnpm latest`
- **THEN** the pointer command executes on the installed Node runtime

#### Scenario: No build step is required

- **WHEN** `pnpm latest` runs on a fresh install
- **THEN** it executes without a preceding build or compile step

### Requirement: Existing data is never modified

The pointer command SHALL only write `data/latest.json` and SHALL NOT modify, move, or delete existing snapshots or change reports.

#### Scenario: Historical data is preserved

- **WHEN** the pointer command runs
- **THEN** existing snapshots and change reports are unchanged

### Requirement: Pointer tests are deterministic and offline

Tests for the pointer command SHALL use local fixtures and temporary directories and SHALL NOT depend on the live OpenCode site or any network service.

#### Scenario: Normal suite stays offline

- **WHEN** the normal test suite runs
- **THEN** pointer tests pass without contacting any network service
