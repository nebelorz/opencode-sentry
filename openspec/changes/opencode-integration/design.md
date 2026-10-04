## Context

See `proposal.md` for motivation and `specs/opencode-integration/spec.md` for the behavior contract.

Current state (verified against the repository):

- The pipeline writes immutable snapshots (`data/snapshots/<minute>.json`), immutable change reports (`data/changes/<minute>.json`), and a pointer `data/latest.json` with `{ "snapshot": "snapshots/...", "changes": "changes/..." }`.
- The repository remote is `https://github.com/nebelorz/opencode-sentry.git` and is public. Raw files are reachable at `https://raw.githubusercontent.com/nebelorz/opencode-sentry/main/`.
- OpenCode loads project skills from `.opencode/skills/` and global skills from `~/.config/opencode/skills/`. A skill is a `SKILL.md` with YAML frontmatter (`name`, `description`).
- The snapshot schema has `schemaVersion`, `source`, `scrapedAt`, and `models[]` where each model has `id`, `name`, and `estimatedRequests` with `fiveHour`, `weekly`, and `monthly` (a non-negative integer or `"unlimited"`).
- The change report schema has `schemaVersion`, `from`, `to`, and `changes[]`, where each change is `model_added`, `model_removed`, or `quota_changed` with previous/current values.

Constraints: keep it small; no server, no endpoint, no auth, no database; the pipeline provides data, not recommendations; no new dependency.

## Goals / Non-Goals

**Goals:**

- A single global skill that turns the committed data into answers about current quotas and recent changes.
- A documented, stable raw data contract.
- Clear freshness reporting and loud behavior on unavailable or malformed data.
- The skill (agent side) may rank by quota as a cost-efficiency proxy.

**Non-Goals:**

- No recommendation logic in the pipeline or in generated data.
- No HTTP server, no Cloudflare, no secret, no database.
- No change to the pipeline, schemas, or workflows.

## Decisions

**1. A skill, not a plugin or tool.**

`~/.config/opencode/skills` is loaded by the agent with no runtime code. A plugin/tool would require the `@opencode-ai/plugin` runtime and a build surface for no benefit at this size. The skill instructs the agent to fetch and read the data and then reason over it. Alternatives considered: a custom tool (`quota_watch_current`) (rejected: heavier, same outcome); an MCP server (rejected: overkill).

**2. Fetch from raw GitHub, resolve through the pointer.**

The skill fetches `.../main/data/latest.json`, then fetches the two referenced files relative to `.../main/data/`. This keeps a single stable URL and avoids listing directories (impossible over raw). The local-clone path is documented as a fallback for offline or private use.

**3. Freshness is explicit.**

The skill MUST report `scrapedAt` for the snapshot and `from`/`to` for the change report, because the raw CDN may serve a slightly stale commit. It MUST NOT present data as live.

**4. Recommendations live in the agent, not the pipeline.**

The skill MAY compare models by `estimatedRequests` as a cost-efficiency proxy and offer guidance, because model selection is the agent's job. The pipeline and its data remain facts only. The skill MUST state that `estimatedRequests` is a quota, not a currency price, because no price data is collected.

**5. Version in the repo, install globally.**

The canonical skill lives at `.opencode/skills/quota-watch/SKILL.md` so it is reviewable and versioned, and a copy is installed to `~/.config/opencode/skills/quota-watch/SKILL.md` so it is available in every project.

## Risks / Trade-offs

- The skill depends on the repository being public -> a private repo would require an authenticated fetch; document the local-clone fallback (accepted).
- Raw GitHub can lag the latest commit by minutes -> handled by reporting `scrapedAt`/`to` (accepted).
- The repo could be pushed stale data if the scheduled workflow is disabled -> the skill can inspect timestamps and warn; no monitoring is added (accepted).
- Duplicating the skill in the repo and globally can drift -> document that the repo copy is canonical and reinstall after edits (accepted).

## Migration Plan

1. Add the skill to `.opencode/skills/quota-watch/SKILL.md` and copy it to `~/.config/opencode/skills/quota-watch/SKILL.md`.
2. Document the raw contract.
3. Rollback: delete both skill directories; no pipeline or data impact.

## Open Questions

- None blocking. If the repository ever becomes private, switch the skill to the local-clone path or an authenticated source.
