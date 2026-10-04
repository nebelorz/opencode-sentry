## Purpose

Refreshes and publishes the OpenCode Sentry data automatically: it schedules quota collection twice daily in UTC, runs the collect, diff, and latest-pointer stages in a validated order, and commits the generated artifacts, without deploying a service, requiring secrets, or requiring a database.

## ADDED Requirements

### Requirement: Collection runs are scheduled twice daily in UTC

The pipeline SHALL run automatically on a schedule at `00:15` and `12:15` UTC, and SHALL use UTC-based scheduling rather than local time.

#### Scenario: Scheduled run fires at both times

- **WHEN** the scheduled trigger fires at `00:15` or `12:15` UTC
- **THEN** the pipeline runs a collection followed by the full data-refresh and commit sequence

#### Scenario: Schedule does not run continuously

- **WHEN** the workflow is configured
- **THEN** it is limited to the two daily scheduled times and does not poll in a loop

### Requirement: Collection runs can be triggered manually

The pipeline SHALL expose a manual trigger (`workflow_dispatch`) that runs the same collection and commit pipeline as a scheduled run.

#### Scenario: Manual run collects and commits

- **WHEN** a maintainer manually dispatches the workflow
- **THEN** it runs collection followed by the same validation and commit stages as a scheduled run

### Requirement: The pipeline order is fixed

The pipeline SHALL execute its stages in the order: collection, diff generation (only after a new snapshot was collected), latest-pointer regeneration, the validation gate, then the generated-data commit. It SHALL NOT run diff generation without a newly collected snapshot and SHALL NOT commit before the pointer is regenerated and validation passes.

#### Scenario: Stages run in order

- **WHEN** a run executes with sufficient history
- **THEN** it collects, runs the diff, regenerates the pointer, runs the validation gate, and then commits generated data

#### Scenario: Pointer and validation precede commit

- **WHEN** a run reaches the commit stage
- **THEN** `data/latest.json` has been regenerated earlier in the same run and the validation gate has passed

### Requirement: The pipeline creates no deployment or server

The pipeline SHALL NOT deploy, publish, or start any service, and SHALL require no Cloudflare or other deployment credentials.

#### Scenario: No deployment step exists

- **WHEN** the workflow runs
- **THEN** it performs no deployment and exposes no deployment secrets

#### Scenario: No service is started

- **WHEN** the pipeline completes
- **THEN** it has only read the source and written generated data to the repository

### Requirement: First-run bootstrap is explicit

When fewer than two snapshots exist, the pipeline SHALL treat the run as bootstrap: it SHALL run collection and commit the resulting snapshot, and SHALL skip diff generation, latest-pointer regeneration, the validation gate, and the derived-artifact commit. The pipeline SHALL NOT alter diff semantics or fabricate a change report.

#### Scenario: First collection does not compute a diff

- **WHEN** the repository has fewer than two snapshots before a run
- **THEN** the pipeline collects one snapshot and commits it, and does not run the diff, the pointer, or the derived commit

#### Scenario: Normal pipeline resumes after bootstrap

- **WHEN** a later run finds at least two snapshots
- **THEN** the pipeline runs the full collect, diff, latest, validate, and commit sequence

#### Scenario: Bootstrap does not change diff behavior

- **WHEN** bootstrap behavior is implemented
- **THEN** the `diff` command still requires at least two snapshots and still fails when fewer exist

### Requirement: Diff failure aborts the run except during bootstrap

Aside from the explicit bootstrap case, the pipeline SHALL fail the run when diff generation fails, and SHALL NOT commit.

#### Scenario: Diff failure aborts

- **WHEN** the diff fails while at least two snapshots exist
- **THEN** the run fails and no generated data is committed

### Requirement: Generated artifacts are committed deterministically

The pipeline SHALL commit only the generated artifacts `data/snapshots/*.json`, `data/changes/*.json`, and `data/latest.json`, using a fixed bot author/committer identity, and SHALL create no commit when those paths have no changes.

#### Scenario: Generated files are committed

- **WHEN** a run produces new snapshots, change reports, or a regenerated pointer
- **THEN** exactly those generated paths are committed under a fixed bot identity

#### Scenario: No empty commit

- **WHEN** the generated paths contain no changes
- **THEN** the pipeline creates no commit

#### Scenario: Unrelated files are not committed

- **WHEN** the pipeline commits generated data
- **THEN** it does not stage or commit files outside the defined generated artifact paths

### Requirement: Generated commits do not trigger workflow loops

The generated-data commit SHALL be pushed using the repository's `GITHUB_TOKEN` so that the resulting push does not start new workflow runs, and the pipeline SHALL NOT require a separate personal access token to avoid loops.

#### Scenario: Data commit does not re-trigger workflows

- **WHEN** the pipeline pushes its generated-data commit
- **THEN** no new workflow run is started by that push

#### Scenario: Loops are avoided without a personal access token

- **WHEN** loop avoidance is implemented
- **THEN** it relies on the `GITHUB_TOKEN` push behavior rather than a stored personal access token

### Requirement: Runs are serialized

The pipeline SHALL use a single concurrency group so that two runs cannot modify the repository at the same time, and SHALL NOT cancel an in-progress run.

#### Scenario: Concurrent runs do not overlap

- **WHEN** a run is already in progress and another is requested
- **THEN** the second run waits rather than running concurrently

#### Scenario: In-progress run is not cancelled

- **WHEN** a new run is requested while one is running
- **THEN** the running run is allowed to finish

### Requirement: Workflow token permissions are least privilege

The pipeline SHALL grant the workflow only the permissions it needs, including `contents: write` for committing generated data, and SHALL NOT grant broader permissions than required.

#### Scenario: Only required permissions are granted

- **WHEN** the workflow is configured
- **THEN** it declares `contents: write` and no unnecessary permissions

### Requirement: Installation is reproducible

The pipeline SHALL install dependencies with the pinned package manager, a Node version matching the project requirement, and `--frozen-lockfile`, so runs are reproducible.

#### Scenario: Frozen install is used

- **WHEN** the pipeline installs dependencies
- **THEN** it uses the pinned pnpm version, a Node version satisfying the project's `engines` range, and a frozen lockfile install

#### Scenario: Lockfile drift fails the run

- **WHEN** the lockfile is out of date with `package.json`
- **THEN** the frozen install fails the run

### Requirement: The validation gate blocks invalid commits

The pipeline SHALL run lint, typecheck, and tests before committing generated data and SHALL fail the run when any of these fail.

#### Scenario: Validation failure blocks commit

- **WHEN** lint, typecheck, or tests fail
- **THEN** the run fails and no generated data is committed

#### Scenario: Validation runs before commit

- **WHEN** the pipeline commits generated data
- **THEN** the validation gate has already passed in the same run

### Requirement: Failures fail loudly

The pipeline SHALL exit with a non-zero status and stop the run whenever collection, diff (outside bootstrap), latest-pointer regeneration, the validation gate, or the generated-data commit fails, and SHALL NOT continue to later stages after a failure.

#### Scenario: Collection failure aborts the run

- **WHEN** collection fails
- **THEN** the run fails and no diff, pointer, validation, or commit occurs

#### Scenario: Invalid generated data is never committed

- **WHEN** generated data is invalid, missing, or only partially written
- **THEN** the run fails before the commit and the previous committed data is left unchanged

### Requirement: Scope stays minimal

This capability SHALL cover scheduled collection and generated-data commits only. It SHALL NOT add deployment, API endpoints, recommendation or ranking logic, a database or external storage, authentication, webhooks, a frontend, or changes to quota parsing or diff semantics.

#### Scenario: No product features are added

- **WHEN** this capability is implemented
- **THEN** only workflow and generated-data changes exist and no new API behavior, storage, authentication, service, or parsing behavior is introduced

#### Scenario: Existing validation workflow is preserved

- **WHEN** this capability is implemented
- **THEN** the existing lint, typecheck, and test CI workflow remains and continues to validate pushes and pull requests
