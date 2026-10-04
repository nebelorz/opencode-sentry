## 1. Skill

- [x] 1.1 Create `.opencode/skills/quota-watch/SKILL.md` with YAML frontmatter (`name`, `description`) and instructions to fetch `data/latest.json` from `https://raw.githubusercontent.com/nebelorz/opencode-sentry/main/data/` and then the referenced snapshot and change report
- [x] 1.2 Include in the skill: report current quotas as a table; report the latest changes (`model_added`, `model_removed`, `quota_changed`); always show `scrapedAt` and `from`/`to`; state that `estimatedRequests` is a quota, not a currency price
- [x] 1.3 Include in the skill: when asked for the best quality/cost or for a recommendation, compare models by `estimatedRequests` as a proxy and make the recommendation in the agent, never inventing values; if data is unavailable or malformed, say so and do not guess
- [x] 1.4 Include in the skill a local-clone fallback path for offline or private-repository use

## 2. Installation

- [x] 2.1 Copy `.opencode/skills/quota-watch/SKILL.md` to `~/.config/opencode/skills/quota-watch/SKILL.md` so the skill is global
- [x] 2.2 Verify the frontmatter is valid YAML and the skill is discoverable (name and description present)

## 3. Documentation

- [x] 3.1 Document the raw data contract (base URL, pointer shape, referenced file shape) in the skill and note it in project documentation
- [x] 3.2 Document that the repository copy is canonical and must be re-copied to the global location after edits

## 4. Verification

- [x] 4.1 After the data is pushed, fetch the raw `data/latest.json` and the referenced files and verify they resolve and are schema-valid
- [ ] 4.2 Invoke the skill in a session and verify it reports current quotas, the latest changes, and freshness timestamps, and that it does not fabricate data when a fetch fails
- [x] 4.3 Verify no server, endpoint, secret, or new dependency was introduced
