## MODIFIED Requirements

### Requirement: Quality claims are labeled agent judgment

When the review makes any quality or suitability claim about a model, the skill SHALL label it as the agent's judgment rather than project data. Committed metadata such as context window, output limit, modalities, and capability flags are facts and MAY be presented as data. The skill SHALL NOT present invented quality scores, benchmark results, or rankings as facts from the committed data.

#### Scenario: Quality is labeled as judgment

- **WHEN** the review describes how capable or suitable a model is
- **THEN** it labels that description as the agent's judgment

#### Scenario: Capability metadata is presented as data

- **WHEN** the review reports a model's context window, output limit, modalities, or capability flags from the committed metadata
- **THEN** it presents those values as facts

#### Scenario: No invented quality metrics

- **WHEN** the committed data contains no quality score or benchmark value
- **THEN** the review does not present any quality score or benchmark number as if it came from the data

### Requirement: Data gaps are disclosed

The review SHALL state that benchmark results are not collected and SHALL NOT fill that gap with guessed values. It SHALL NOT report currency price, context window, or model capabilities as globally uncollected, because they are collected when the source provides them. When an individual model has no committed metadata, the review SHALL state that metadata is not available for that model instead of reporting the whole category as missing.

#### Scenario: Missing facts are listed

- **WHEN** the review is presented
- **THEN** it names benchmark results as the fact that is not collected

#### Scenario: Collected categories are not reported as global gaps

- **WHEN** the review lists data gaps
- **THEN** it does not list currency price, context window, or model capabilities as globally uncollected

#### Scenario: Per-model metadata absence is disclosed

- **WHEN** an individual model has no committed metadata
- **THEN** the review states that metadata is not available for that model

#### Scenario: Gaps are not filled with guesses

- **WHEN** a fact is not present in the committed data
- **THEN** the review marks it as not collected rather than supplying an estimated or remembered value as data

## ADDED Requirements

### Requirement: The review uses committed model metadata

The review SHALL present a model's committed metadata as facts: context window, output limit, input and output modalities, and capability flags. It SHALL NOT present metadata for a model that has none, and SHALL NOT invent context, limits, modalities, or capabilities.

#### Scenario: Metadata is presented as facts

- **WHEN** a model has committed metadata
- **THEN** the review presents its context window, output limit, modalities, and capability flags as data

#### Scenario: Metadata is presented per model

- **WHEN** the review compares models
- **THEN** it reports each model's metadata only for that model

#### Scenario: Missing metadata is not invented

- **WHEN** a model has no committed metadata
- **THEN** the review states that metadata is not available rather than supplying a value
