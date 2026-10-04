# quota-watch-review Specification

## Purpose

Defines how the `quota-watch` skill turns committed OpenCode Go quota data into a cost-efficiency review, ranking models by value while clearly separating project facts from the agent's judgment and disclosing which facts are not collected.

## Requirements

### Requirement: The allowance rule is explained

The review SHALL explain that each model's quota is expressed as a 5-hour value at roughly 20 percent, a weekly value at roughly 50 percent, and a monthly value at 100 percent of the model's monthly allowance. It SHALL state that `estimatedRequests` is a usage quota rather than a currency price, and that token prices and the monthly limit in USD are collected separately and attached to each model.

#### Scenario: The 20/50/100 rule is stated

- **WHEN** the review is presented
- **THEN** it explains the 5-hour, weekly, and monthly relationship as roughly 20, 50, and 100 percent of the monthly allowance

#### Scenario: Quota is distinguished from price

- **WHEN** the review discusses cost
- **THEN** it states that `estimatedRequests` is a quota and points to the separately collected token prices and monthly limit

#### Scenario: The monthly limit is shown as a USD allowance

- **WHEN** a model's pricing is presented
- **THEN** the review shows the model's monthly limit in USD, or `unlimited` when the source says so

### Requirement: The review presents value tiers and a short recommendation

The review SHALL present models grouped into value tiers derived from their monthly estimated requests, and SHALL end with a short recommendation. The tier boundaries and the recommendation SHALL be presented as the agent's judgment, not as project data.

#### Scenario: Value tiers are shown

- **WHEN** the review is presented
- **THEN** it groups models into value tiers based on their monthly estimated requests

#### Scenario: A recommendation is given

- **WHEN** the review is presented
- **THEN** it includes a short recommendation that is labeled as the agent's judgment

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

### Requirement: Value ranking uses committed pricing and quota data

The review SHALL rank models using only values present in the committed snapshot. It SHALL use the committed token prices and monthly limits to present cost efficiency, and MAY use monthly `estimatedRequests` as a usage-volume proxy. The review SHALL NOT use any price, cost, or quantity that is not present in the committed data.

#### Scenario: Models are ranked by cost efficiency from committed prices

- **WHEN** the user asks which model is the best value
- **THEN** the review orders or groups models using the committed token prices and monthly limits

#### Scenario: Usage volume is available from monthly estimated requests

- **WHEN** the review compares models by usage volume
- **THEN** it uses the monthly `estimatedRequests` from the snapshot

#### Scenario: Unlimited is ranked as the most permissive

- **WHEN** a model's monthly `estimatedRequests` or monthly limit is `unlimited`
- **THEN** the review presents it as the most permissive rather than as a number and does not compare it numerically

#### Scenario: No values outside the committed data

- **WHEN** the review ranks models
- **THEN** it uses only committed values and does not introduce any price, cost, or quantity not present in the snapshot

### Requirement: The review uses committed pricing

The review SHALL present cost using the committed per-token prices and monthly limits, SHALL distinguish plans and price variants when present, and SHALL NOT invent a price for any model, plan, or variant missing from the committed data.

#### Scenario: Prices are presented per plan

- **WHEN** the review presents cost
- **THEN** it shows the committed prices for each available plan

#### Scenario: Variants are distinguished

- **WHEN** a model has peak and off-peak entries, or token-tier entries
- **THEN** the review presents the distinct variants rather than collapsing them into one price

#### Scenario: Missing price is not invented

- **WHEN** a model, plan, or variant has no committed price
- **THEN** the review states that it is not available instead of supplying a value

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
