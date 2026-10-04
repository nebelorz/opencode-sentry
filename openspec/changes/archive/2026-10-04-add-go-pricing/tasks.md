## 1. Schema and normalization

- [x] 1.1 Add an optional `pricing` array to the snapshot model schema and export the pricing types in `src/schema/snapshot.ts`, and verify `pnpm typecheck` passes and existing snapshot fixtures still validate
- [x] 1.2 Add pricing normalizers for price cells (`Free` to `0`, `-` to `null`, numeric parsing) and monthly-limit cells (`$60` to `{ amount: 60, currency: "USD" }`, `Unlimited` to `unlimited`) in `src/collector/normalize.ts`, and verify new unit tests cover each case and reject unrecognized values

## 2. Parse pricing tables

- [x] 2.1 Add a pricing table parser in `src/collector/parse.ts` that selects the two pricing tables by their header set and associates each with a plan, and verify unit tests locate both plan tables and fail when a table is missing
- [x] 2.2 Derive a variant key and label per row from the model cell, map columns by header text order-independently, and verify unit tests cover default, peak/off-peak, token-tier, reordered headers, and a missing required header

## 3. Match and assemble

- [x] 3.1 Match pricing rows to snapshot models by the normalized base name, allowing multiple variants per model and plan, and verify unit tests cover base-name stripping, multiple variants, an unknown pricing model, and a model missing pricing for a plan
- [x] 3.2 Assemble the pricing entries into each model in `src/collector/match.ts` and `src/collector/snapshot.ts`, and verify a collected snapshot validates against the schema and includes both plans

## 4. Review and skill

- [x] 4.1 Update the review guidance in `.opencode/skills/quota-watch/SKILL.md` to rank by committed prices and monthly limits, explain the quota-versus-price distinction, present plan and variant prices, and drop currency price from the data-gap list
- [x] 4.2 Reinstall the skill at `~/.config/opencode/skills/quota-watch/SKILL.md` and verify the repository and installed copies match and the frontmatter is valid YAML

## 5. Verification

- [x] 5.1 Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` and verify all pass
- [x] 5.2 Confirm no diff, API, dependency, or output-directory change was introduced, and that historical snapshot fixtures still load
- [x] 5.3 Run `openspec validate add-go-pricing --strict` and verify it passes
