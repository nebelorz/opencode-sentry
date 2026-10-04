## Context

See proposal.md - Why. The `quota-watch` skill already reads the committed snapshot and change report over raw GitHub and reports quotas and recent changes. Its only review guidance today is a single line telling the agent to compare models by `estimatedRequests` as a proxy. The committed data currently contains only `estimatedRequests` per model; it has no price, context, capability, or benchmark fields. The `opencode-integration` capability that owns the skill is still an in-progress change and is not yet in `openspec/specs/`.

## Goals / Non-Goals

**Goals:**

- Define a repeatable review procedure for the skill that works with today's committed data.
- Keep the pipeline strictly facts-only: no schema, collector, or diff changes.
- Make the fact/judgment boundary explicit in the review output.

**Non-Goals:**

- Adding price, context, capability, or benchmark data (deferred to later changes).
- Changing how quotas and changes are fetched or reported.
- Choosing or shipping a benchmark-based quality score.

## Decisions

**New capability `quota-watch-review` rather than modifying `opencode-integration`.**
The review is a distinct behavior, and `opencode-integration` has no baseline in `openspec/specs/` to modify. A new capability avoids inventing a baseline and keeps the review contract self-contained. Alternative considered: sync `opencode-integration` to main specs first, then modify it; rejected as extra scope the user did not request.

**Phase 1 is data-free.**
The review is built on `estimatedRequests` only, so it can ship before any pipeline work and cannot misrepresent data that does not exist yet. This also fixes the review's vocabulary and output shape before later phases add price and metadata.

**Tier boundaries are agent judgment, not data.**
The pipeline stays facts-only, so value tiers and the final recommendation are defined as the agent's judgment and labeled as such. Alternative considered: encode fixed tier thresholds; rejected because it pulls policy into the pipeline and would drift as the model list changes.

**Disclose data gaps in the output.**
The skill states which facts are not collected (price, context, capabilities, benchmarks). This prevents the agent from silently substituting remembered values and sets correct expectations until later phases land.

## Risks / Trade-offs

- [Agent still presents a quality or price claim as fact] -> The spec requires labeling and gap disclosure, and the skill wording will reinforce it; later phases add real data.
- [Installed global copy drifts from the repository copy] -> Keep the existing maintenance step: after editing, re-copy to `~/.config/opencode/skills/quota-watch/SKILL.md`.
- [Tier thresholds feel arbitrary] -> Label them as judgment and derive them from the observed distribution rather than fixed constants.
- [Later phases rename or restructure the review contract] -> The new capability is small and additive; later changes can modify it cleanly.
