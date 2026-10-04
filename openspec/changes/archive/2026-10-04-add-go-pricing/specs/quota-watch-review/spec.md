## REMOVED Requirements

### Requirement: Value ranking is derived only from committed quota data
**Reason**: Superseded now that per-model token prices and monthly limits are collected. Ranking by usage counts alone is no longer the intended behavior.
**Migration**: Use the "Value ranking uses committed pricing and quota data" requirement. Consumers read the optional `pricing` entries added to snapshot models.

## MODIFIED Requirements

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

### Requirement: Data gaps are disclosed

The review SHALL state that the committed data does not include context window, model capabilities, or benchmark results, and SHALL NOT fill those gaps with guessed values. The review SHALL NOT report currency price as a data gap, because per-model token prices and monthly limits are collected.

#### Scenario: Missing facts are listed

- **WHEN** the review is presented
- **THEN** it names the facts that are not collected, including context window, capabilities, and benchmarks

#### Scenario: Price is not reported as a gap

- **WHEN** the review lists data gaps
- **THEN** it does not list currency price, because committed pricing is available

#### Scenario: Gaps are not filled with guesses

- **WHEN** a fact is not present in the committed data
- **THEN** the review marks it as not collected rather than supplying an estimated or remembered value as data

## ADDED Requirements

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
