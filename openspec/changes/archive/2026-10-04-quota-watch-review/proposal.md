## Why

The `quota-watch` skill can report current quotas and recent changes, but when asked "which model is the best value?" it only offers a one-line cost-efficiency proxy. Users want a fuller, trustworthy review that ranks models by value and clearly separates project facts from the agent's judgment, before richer data (prices, context, capabilities, benchmarks) is collected.

## What Changes

- Add a defined review procedure to the `quota-watch` skill: a value-tier ranking derived from monthly estimated requests, an explanation of the 5-hour/week/month allowance rule (20% / 50% / 100% of the monthly allowance), and a clearly labeled agent-side quality judgment.
- Require the review to disclose which facts are not yet collected (no currency price, no context window, no capabilities, no benchmarks) and to never invent them.
- Require a compact, deterministic output shape: value tiers plus a short recommendation, facts first and opinions labeled.
- No changes to the collector, diff, schemas, or committed data. No new dependency, server, or endpoint.
- Update the canonical skill in the repository and reinstall the global copy.

## Capabilities

### New Capabilities

- `quota-watch-review`: the agent-side review behavior of the quota-watch skill, covering value ranking from committed quota data, the allowance-rule explanation, a labeled quality judgment, and explicit disclosure of data gaps.

### Modified Capabilities

- None.

## Impact

- `.opencode/skills/quota-watch/SKILL.md` (review guidance) and the installed copy at `~/.config/opencode/skills/quota-watch/SKILL.md`.
- No pipeline, schema, data, dependency, or endpoint changes.
- Prerequisite for later changes that add Go economics to the pipeline and models.dev metadata enrichment.
