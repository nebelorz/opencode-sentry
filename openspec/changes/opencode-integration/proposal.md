## Why

The data is only useful if the user's OpenCode agent can read it during normal work. A global skill gives the agent a repeatable way to fetch the latest snapshot and change report from raw GitHub and answer quota questions such as "did DeepSeek V4.1 Flash quota change?". Without it, the committed JSON has no machine-facing entry point.

## What Changes

- Add a global OpenCode skill `quota-watch` that fetches `data/latest.json` and the snapshot and change report it references from raw GitHub, then reports current quotas and recent changes.
- The skill SHALL surface freshness (`scrapedAt`, report `from`/`to`) and MAY compare models by estimated requests as a cost-efficiency proxy and offer a recommendation; the recommendation policy lives in the skill/agent, not in the pipeline.
- Version the skill in the repository and install it to `~/.config/opencode/skills/quota-watch/`.
- Document the raw data contract (base URL and pointer shape).
- No server, no endpoint, no authentication, and no new pipeline behavior.

## Capabilities

### New Capabilities

- `opencode-integration`: the agent-facing skill and the raw GitHub data contract it consumes.

### Modified Capabilities

- None.

## Impact

- Add `.opencode/skills/quota-watch/SKILL.md` to the repository and a copy at `~/.config/opencode/skills/quota-watch/SKILL.md`.
- Add documentation of the raw data contract.
- No changes to the collector, diff, pointer, schemas, or workflows; no new dependency.
- Depends on fresh data being committed by the `scheduled-collection` change.
