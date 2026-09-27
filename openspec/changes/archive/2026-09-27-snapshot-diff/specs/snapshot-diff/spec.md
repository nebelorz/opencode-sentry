## Purpose

Compares the latest stored quota snapshot against the immediately preceding one and produces a deterministic, machine-readable change report capturing model additions, model removals, and per-period quota changes, including `unlimited` and zero-value transitions.

## ADDED Requirements

### Requirement: Snapshots are loaded from the snapshots directory

The diff SHALL read snapshot files from the local snapshots directory `data/snapshots/` and SHALL treat each file as untrusted input. It SHALL load only JSON snapshot files and SHALL NOT obtain snapshots from any network, API, or external source.

#### Scenario: Snapshots are read from the snapshots directory

- **WHEN** the diff runs and `data/snapshots/` contains snapshot JSON files
- **THEN** it loads those snapshot files for comparison

#### Scenario: No external source is used

- **WHEN** the diff loads snapshots
- **THEN** it reads them only from the local snapshots directory and performs no network request

### Requirement: Snapshots are validated before use

The diff SHALL validate every loaded snapshot against the existing snapshot schema before using it. It SHALL reuse the existing snapshot schema and SHALL NOT define a second snapshot schema. If any loaded snapshot file cannot be read, cannot be parsed as JSON, or does not satisfy the snapshot schema, the diff SHALL fail, SHALL NOT produce a change report, and SHALL NOT modify any file.

#### Scenario: Valid snapshots pass validation

- **WHEN** a loaded snapshot satisfies the snapshot schema
- **THEN** the diff accepts it for comparison

#### Scenario: Invalid previous snapshot aborts the diff

- **WHEN** the snapshot selected as the previous baseline does not satisfy the snapshot schema
- **THEN** the diff fails and no change report is written

#### Scenario: Invalid latest snapshot aborts the diff

- **WHEN** the snapshot selected as the latest does not satisfy the snapshot schema
- **THEN** the diff fails and no change report is written

#### Scenario: Unreadable or malformed snapshot aborts the diff

- **WHEN** a loaded snapshot file cannot be read or cannot be parsed as JSON
- **THEN** the diff fails and no change report is written

#### Scenario: No snapshot schema is duplicated

- **WHEN** the diff validates snapshots
- **THEN** it uses the project's existing snapshot schema and introduces no alternative snapshot schema

### Requirement: The latest two snapshots are selected chronologically

The diff SHALL order loaded snapshots chronologically by their snapshot timestamp (`scrapedAt`) and SHALL compare exactly the latest snapshot as the current state against the immediately preceding snapshot as the baseline. It SHALL NOT compare against arbitrary or older historical snapshots. If fewer than two valid snapshots exist, the diff SHALL fail, SHALL write no change report, and SHALL clearly indicate that at least two snapshots are required.

#### Scenario: Exactly two snapshots are compared

- **WHEN** `data/snapshots/` contains exactly two valid snapshots
- **THEN** the diff compares the earlier snapshot as the baseline against the later snapshot as the current state

#### Scenario: More than two snapshots selects the latest two

- **WHEN** `data/snapshots/` contains more than two valid snapshots
- **THEN** the diff compares only the two most recent snapshots and ignores the rest

#### Scenario: Fewer than two snapshots aborts the diff

- **WHEN** `data/snapshots/` contains fewer than two valid snapshots
- **THEN** the diff fails, writes no change report, and reports that at least two snapshots are required

#### Scenario: No initial diff is invented

- **WHEN** only one valid snapshot exists
- **THEN** the diff does not fabricate a baseline and does not produce a change report

### Requirement: Models are matched by stable id

The diff SHALL identify and match models by their stable `id`. It SHALL NOT match models by display name, and it SHALL treat the model `id` as the canonical identity of a model.

#### Scenario: Models are matched by id

- **WHEN** the same `id` appears in both snapshots
- **THEN** the diff treats it as the same model for comparison

#### Scenario: Models are not matched by name

- **WHEN** two models share a display name but have different `id` values, or share an `id` but have different display names
- **THEN** the diff matches by `id` and not by name

### Requirement: Model additions are detected

The diff SHALL detect each model whose `id` exists in the latest snapshot but not in the previous snapshot and SHALL emit one `model_added` change per such model. A `model_added` change SHALL contain the model's `id` and `name` and its complete current `estimatedRequests` values (`fiveHour`, `weekly`, and `monthly`).

#### Scenario: Added model is reported

- **WHEN** a model with a new `id` appears in the latest snapshot
- **THEN** the diff emits a `model_added` change containing the model's `id`, `name`, and complete current quota values

#### Scenario: Multiple models added are reported individually

- **WHEN** more than one model is added
- **THEN** the diff emits one `model_added` change per added model

#### Scenario: Unchanged existing models are not reported as added

- **WHEN** a model exists in both snapshots
- **THEN** the diff does not emit a `model_added` change for it

### Requirement: Model removals are detected

The diff SHALL detect each model whose `id` exists in the previous snapshot but not in the latest snapshot and SHALL emit one `model_removed` change per such model. A `model_removed` change SHALL contain the model's `id` and `name` and its previous `estimatedRequests` values (`fiveHour`, `weekly`, and `monthly`).

#### Scenario: Removed model is reported

- **WHEN** a model present in the previous snapshot is absent from the latest snapshot
- **THEN** the diff emits a `model_removed` change containing the model's `id`, `name`, and previous quota values

#### Scenario: Multiple models removed are reported individually

- **WHEN** more than one model is removed
- **THEN** the diff emits one `model_removed` change per removed model

#### Scenario: Models present in both are not reported as removed

- **WHEN** a model exists in both snapshots
- **THEN** the diff does not emit a `model_removed` change for it

### Requirement: Quota changes are detected per period

For each model present in both snapshots, the diff SHALL compare the `fiveHour`, `weekly`, and `monthly` quota values independently and SHALL emit one `quota_changed` change for each period whose value changed. A single model MAY produce multiple `quota_changed` changes. Each `quota_changed` change SHALL contain the model's `id` and `name` and a `quota` object with the `period`, the `previous` value, the `current` value, the numeric `change`, and the numeric `changePercent`. Periods whose value did not change SHALL NOT produce a change.

#### Scenario: Changed period is reported

- **WHEN** a model's quota value differs between the two snapshots for a period
- **THEN** the diff emits a `quota_changed` change for that model and period

#### Scenario: Multiple periods changed for one model produce multiple changes

- **WHEN** more than one quota period changes for the same model
- **THEN** the diff emits one `quota_changed` change per changed period and does not combine them into a single object

#### Scenario: Multiple models changed are reported individually

- **WHEN** quota values change for more than one model
- **THEN** the diff emits the corresponding `quota_changed` changes for each affected model

#### Scenario: Unchanged period is not reported

- **WHEN** a model's quota value is identical in both snapshots for a period
- **THEN** the diff emits no `quota_changed` change for that period

### Requirement: Numeric quota changes are computed safely

For a quota change where both the previous and current values are numeric, the diff SHALL compute `change` as `current - previous` and `changePercent` as `((current - previous) / previous) * 100`, rounded to two decimal places. When the previous numeric value is `0`, the diff SHALL emit a numeric `change` and SHALL represent `changePercent` as `null` rather than dividing by zero. The diff SHALL NOT produce `NaN`, `Infinity`, or any non-finite or JavaScript-specific numeric value.

#### Scenario: Numeric change and percentage are computed

- **WHEN** a quota period changes from `2150` to `1000`
- **THEN** the change has `change` equal to `-1150` and `changePercent` equal to `-53.49`

#### Scenario: Previous value of zero avoids division by zero

- **WHEN** a quota period changes from `0` to a positive numeric value
- **THEN** the change has a numeric `change` and `changePercent` equal to `null`

#### Scenario: Change to zero is computed

- **WHEN** a quota period changes from a positive numeric value to `0`
- **THEN** the change has a numeric `change` and a numeric `changePercent`

#### Scenario: No non-finite values are produced

- **WHEN** any quota change is computed
- **THEN** the change contains no `NaN`, `Infinity`, or `-Infinity` value

### Requirement: Unlimited transitions are represented explicitly

The diff SHALL handle quota values of `unlimited` explicitly. A transition from `unlimited` to `unlimited` SHALL NOT be a change. A transition from a numeric value to `unlimited` and a transition from `unlimited` to a numeric value SHALL each be a change. For any change involving an `unlimited` value on either side, the diff SHALL represent `change` and `changePercent` as `null` and SHALL NOT emit a numeric difference or a non-finite value. The `previous` and `current` fields SHALL retain the actual quota values, including `unlimited`.

#### Scenario: Numeric to unlimited is a change

- **WHEN** a quota period changes from a numeric value to `unlimited`
- **THEN** the diff emits a `quota_changed` change with `previous` numeric, `current` equal to `unlimited`, and both `change` and `changePercent` equal to `null`

#### Scenario: Unlimited to numeric is a change

- **WHEN** a quota period changes from `unlimited` to a numeric value
- **THEN** the diff emits a `quota_changed` change with `previous` equal to `unlimited`, `current` numeric, and both `change` and `changePercent` equal to `null`

#### Scenario: Unlimited to unlimited is not a change

- **WHEN** a quota period is `unlimited` in both snapshots
- **THEN** the diff emits no `quota_changed` change for that period

#### Scenario: No non-finite values for unlimited transitions

- **WHEN** a quota change involves `unlimited`
- **THEN** the change contains no `NaN`, `Infinity`, or `-Infinity` value

### Requirement: The change report conforms to the change-report schema

The diff SHALL produce a change report that conforms to a dedicated change-report schema. The diff SHALL NOT reuse the snapshot schema for the change report and SHALL validate the report against the change-report schema before persistence. The report SHALL contain `schemaVersion` set to `1`, a `from` field equal to the previous snapshot's timestamp, a `to` field equal to the latest snapshot's timestamp, and a `changes` array. The report SHALL represent only the transition between the two snapshots and SHALL NOT embed the complete snapshots. Each change SHALL be one of `model_added`, `model_removed`, or `quota_changed`, and the quota change's `change` and `changePercent` SHALL be nullable numbers.

#### Scenario: Report metadata identifies the transition

- **WHEN** a change report is produced
- **THEN** `schemaVersion` is `1`, `from` equals the previous snapshot's `scrapedAt`, and `to` equals the latest snapshot's `scrapedAt`

#### Scenario: Report does not embed full snapshots

- **WHEN** a change report is produced
- **THEN** it contains only the detected changes and does not contain the complete previous or latest snapshot

#### Scenario: Invalid report is rejected

- **WHEN** the assembled change report does not satisfy the change-report schema
- **THEN** the diff fails and no report is written

#### Scenario: Changes are typed

- **WHEN** a change report is produced
- **THEN** every change is of type `model_added`, `model_removed`, or `quota_changed` and contains the fields required for that type

### Requirement: An empty change report is valid

The diff SHALL treat a comparison that produces no changes as a valid result and SHALL produce a change report with an empty `changes` array. An empty result SHALL NOT be treated as an error.

#### Scenario: No changes produces an empty report

- **WHEN** the two snapshots are equivalent
- **THEN** the diff produces a valid change report whose `changes` array is empty

#### Scenario: Empty result is not an error

- **WHEN** no changes are detected
- **THEN** the diff completes successfully rather than failing

### Requirement: Change ordering is deterministic

The diff SHALL order changes deterministically. It SHALL order changes by category in the sequence `model_added`, then `model_removed`, then `quota_changed`, within each category by model `id`, and within `quota_changed` by quota period in the sequence `fiveHour`, `weekly`, `monthly`. The diff SHALL NOT rely on object iteration order as an implicit ordering rule. Given the same two snapshots, the diff SHALL produce an equivalent report with the same ordering.

#### Scenario: Categories are ordered

- **WHEN** a report contains changes of multiple types
- **THEN** all `model_added` changes appear before `model_removed` changes, which appear before `quota_changed` changes

#### Scenario: Models are ordered within a category

- **WHEN** a category contains changes for multiple models
- **THEN** the changes are ordered by model `id`

#### Scenario: Periods are ordered within a model

- **WHEN** a single model has multiple `quota_changed` changes
- **THEN** the changes are ordered `fiveHour`, then `weekly`, then `monthly`

#### Scenario: Repeated calculation is stable

- **WHEN** the diff is calculated twice from identical snapshots
- **THEN** both reports are equivalent and preserve the same ordering

### Requirement: Change reports are persisted immutably

The diff SHALL write a validated change report as JSON to `data/changes/<timestamp>.json`, where `<timestamp>` uses the same filesystem-safe UTC minute-precision convention already used for snapshots and is derived from the latest snapshot timestamp. The diff SHALL NOT overwrite or modify an existing report and SHALL provide no overwrite or force option. If a report already exists at the target path, the diff SHALL fail. On any failure, no new or partially written report SHALL remain under `data/changes/`.

#### Scenario: Validated report is written

- **WHEN** the diff succeeds and no file exists at the target path
- **THEN** the report is written as JSON to `data/changes/<timestamp>.json` using the latest snapshot timestamp

#### Scenario: Existing report is preserved

- **WHEN** a file already exists at the target report path
- **THEN** the diff does not overwrite it and fails instead

#### Scenario: No force or overwrite option

- **WHEN** the diff is run
- **THEN** it exposes no overwrite or force option that could replace an existing report

#### Scenario: No partial report on failure

- **WHEN** any stage of the diff fails
- **THEN** no new or partially written report remains under `data/changes/`

#### Scenario: Empty report is persisted

- **WHEN** the comparison produces no changes
- **THEN** the empty change report is still written successfully

### Requirement: The comparison is pure and independent

The diff comparison SHALL be a pure operation over two snapshots, producing the changes or change report without reading or writing files. Snapshot loading, report persistence, and CLI orchestration SHALL remain separate from the comparison logic. The diff SHALL NOT contain collector, scraping, API, or HTTP concerns, and SHALL NOT introduce repository, service, factory, or dependency-injection abstractions.

#### Scenario: Comparison is side-effect free

- **WHEN** the comparison is invoked with two snapshots
- **THEN** it returns the detected changes without reading or writing any file

#### Scenario: Persistence is separate from comparison

- **WHEN** the diff persists a report
- **THEN** filesystem writing is performed outside the comparison logic

#### Scenario: Diff does not scrape or serve HTTP

- **WHEN** the diff runs
- **THEN** it does not fetch the source documentation, parse HTML, register routes, or depend on the API runtime

### Requirement: The diff is exposed as a package script

The project SHALL expose a `diff` package script such that `pnpm diff` runs the diff pipeline using production defaults. Running `pnpm diff` SHALL NOT execute the test suite, SHALL require no CLI arguments, flags, or configuration files, and SHALL add no new runtime dependency. The script SHALL orchestrate the existing diff logic without reimplementing it.

#### Scenario: Diff script runs the pipeline

- **WHEN** a user runs `pnpm diff`
- **THEN** the diff pipeline loads the snapshots, selects the latest two, validates them, calculates the diff, validates the report, and persists it

#### Scenario: Diff script uses production defaults

- **WHEN** `pnpm diff` is run without extra configuration
- **THEN** it uses the default snapshots directory and changes directory and needs no arguments or configuration

#### Scenario: Diff script does not run tests or add dependencies

- **WHEN** a user runs `pnpm diff`
- **THEN** the test suite is not executed and no new runtime dependency is required

### Requirement: Failures fail loudly without publishing data

When any diff stage fails, the command SHALL exit with a non-zero status, SHALL write a useful error to stderr, and SHALL NOT leave a new, partial, or invalid report behind. The command SHALL NOT swallow errors.

#### Scenario: Diff failure exits non-zero

- **WHEN** any diff stage throws an error
- **THEN** the process exits with a non-zero status

#### Scenario: Error is surfaced

- **WHEN** the diff fails
- **THEN** a useful error is written to stderr and is not swallowed

#### Scenario: Success exits successfully

- **WHEN** the diff succeeds
- **THEN** the process exits with a zero exit status

### Requirement: Tests are deterministic and offline

Diff tests SHALL verify comparison, validation, persistence, and snapshot selection using local fixtures and temporary directories and SHALL NOT require network access.

#### Scenario: Normal suite stays offline

- **WHEN** the normal test suite runs
- **THEN** the diff tests pass without contacting the live OpenCode documentation or any network service

#### Scenario: Comparison covers required cases

- **WHEN** the diff tests run
- **THEN** they cover model additions, removals, per-period quota changes, `unlimited` transitions, zero-value transitions, validation failures, persistence, snapshot selection, and determinism
