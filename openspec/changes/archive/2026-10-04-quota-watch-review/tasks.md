## 1. Skill review guidance

- [x] 1.1 Update `.opencode/skills/quota-watch/SKILL.md` to define a value-tier review ranked by monthly `estimatedRequests`, and verify the review section states the 20/50/100 allowance rule and that `estimatedRequests` is a quota, not a price
- [x] 1.2 Add the labeled agent quality judgment to the skill, and verify the wording states that quality claims are the agent's judgment and that no quality score or benchmark number may be presented as data
- [x] 1.3 Add the data-gap disclosure to the skill, and verify it names the uncollected facts (currency price, context window, capabilities, benchmarks) and forbids substituting remembered values
- [x] 1.4 Define the compact review output shape (value tiers plus a short recommendation), and verify the skill instructs producing tiers and a recommendation labeled as judgment

## 2. Installation

- [x] 2.1 Copy the updated `.opencode/skills/quota-watch/SKILL.md` to `~/.config/opencode/skills/quota-watch/SKILL.md` and verify the two files match
- [x] 2.2 Verify the installed frontmatter is valid YAML with `name` and `description` present

## 3. Verification

- [x] 3.1 Invoke the skill and confirm it returns a value-tier review with the allowance rule, a labeled quality judgment, a short recommendation, and the listed data gaps, and does not invent price, context, capability, or benchmark values
- [x] 3.2 Confirm only skill files changed and that no collector, diff, schema, data, or dependency change was introduced
- [x] 3.3 Run `openspec validate quota-watch-review --strict` and verify it passes
