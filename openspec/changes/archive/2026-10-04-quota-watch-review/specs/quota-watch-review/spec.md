## Purpose

Defines how the `quota-watch` skill turns committed OpenCode Go quota data into a cost-efficiency review, ranking models by value while clearly separating project facts from the agent's judgment and disclosing which facts are not collected.

## ADDED Requirements

### Requirement: Value ranking is derived only from committed quota data

The review SHALL rank models by their monthly `estimatedRequests` from the latest snapshot, treating a higher monthly value as better cost-efficiency for the same plan. The review SHALL NOT rank or score models using currency prices, per-token costs, or any value not present in the committed data.

#### Scenario: Models are ranked by monthly estimated requests

- **WHEN** the user asks which model is the best value
- **THEN** the review orders models by their monthly `estimatedRequests` from the snapshot

#### Scenario: Unlimited is ranked as the most permissive

- **WHEN** a model's monthly `estimatedRequests` is `"unlimited"`
- **THEN** the review presents it as the most permissive rather than as a number and does not compare it numerically

#### Scenario: No price-based ranking

- **WHEN** the review ranks models
- **THEN** it uses only committed quota values and does not introduce currency prices or per-token costs

### Requirement: The allowance rule is explained

The review SHALL explain that each model's quota is expressed as a 5-hour value at roughly 20 percent, a weekly value at roughly 50 percent, and a monthly value at 100 percent of the model's monthly allowance, and SHALL state that `estimatedRequests` is a quota rather than a currency price.

#### Scenario: The 20/50/100 rule is stated

- **WHEN** the review is presented
- **THEN** it explains the 5-hour, weekly, and monthly relationship as roughly 20, 50, and 100 percent of the monthly allowance

#### Scenario: Quota is distinguished from price

- **WHEN** the review discusses cost
- **THEN** it states that `estimatedRequests` is a quota and that no currency price is collected

### Requirement: The review presents value tiers and a short recommendation

The review SHALL present models grouped into value tiers derived from their monthly estimated requests, and SHALL end with a short recommendation. The tier boundaries and the recommendation SHALL be presented as the agent's judgment, not as project data.

#### Scenario: Value tiers are shown

- **WHEN** the review is presented
- **THEN** it groups models into value tiers based on their monthly estimated requests

#### Scenario: A recommendation is given

- **WHEN** the review is presented
- **THEN** it includes a short recommendation that is labeled as the agent's judgment

### Requirement: Quality claims are labeled agent judgment

When the review makes any quality claim about a model, the skill SHALL label it as the agent's judgment rather than project data, and SHALL NOT present invented quality scores, benchmark results, or rankings as facts from the committed data.

#### Scenario: Quality is labeled as judgment

- **WHEN** the review describes how capable or suitable a model is
- **THEN** it labels that description as the agent's judgment

#### Scenario: No invented quality metrics

- **WHEN** the committed data contains no quality or benchmark values
- **THEN** the review does not present any quality score or benchmark number as if it came from the data

### Requirement: Data gaps are disclosed

The review SHALL state that the committed data does not include currency price, context window, model capabilities, or benchmark results, and SHALL NOT fill those gaps with guessed values.

#### Scenario: Missing facts are listed

- **WHEN** the review is presented
- **THEN** it names the facts that are not collected, including currency price, context window, capabilities, and benchmarks

#### Scenario: Gaps are not filled with guesses

- **WHEN** a fact is not present in the committed data
- **THEN** the review marks it as not collected rather than supplying an estimated or remembered value as data
