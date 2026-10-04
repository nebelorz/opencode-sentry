## 1. Metadata schema and mapping

- [x] 1.1 Define the metadata schema and types in `src/schema/snapshot.ts` (or a sibling schema module) covering context and output limits, modalities, capability flags, family, knowledge cutoff, release date, and canonical model id, and verify `pnpm typecheck` passes and historical snapshot fixtures still validate
- [x] 1.2 Add the models.dev catalog client under `src/metadata/` that fetches `https://models.dev/api.json`, selects the `opencode-go` provider, and fails loudly on fetch failure or a missing provider, and verify fixture-based unit tests cover success and each failure
- [x] 1.3 Map a catalog entry to the selected metadata fields and exclude provider, endpoint, environment, package, and description fields, and verify unit tests assert the stored shape and the excluded fields

## 2. Matching and integration

- [x] 2.1 Match each snapshot model to a catalog entry by exact, case-sensitive id, attach metadata when matched, and omit it without inventing values when unmatched, and verify unit tests cover a match, a missing entry, and multiple models where only some match
- [x] 2.2 Invoke the enrichment stage from the collection pipeline after the snapshot is assembled and before validation and persistence, and verify a collected snapshot validates against the schema and includes metadata for matched models
- [x] 2.3 Verify invalid selected metadata aborts the enrichment and no snapshot with metadata is written, and that a missing catalog entry does not abort the collection

## 3. Review and skill

- [x] 3.1 Update the review guidance in `.opencode/skills/quota-watch/SKILL.md` to present context, output limit, modalities, and capabilities from committed metadata as facts, keep suitability claims labeled as judgment, drop context window and capabilities from the global data-gap list, and disclose per-model metadata absence
- [x] 3.2 Reinstall the skill at `~/.config/opencode/skills/quota-watch/SKILL.md` and verify the repository and installed copies match and the frontmatter is valid YAML

## 4. Verification

- [x] 4.1 Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` and verify all pass
- [x] 4.2 Confirm no diff, API, dependency, or output-directory change was introduced, and that historical snapshot fixtures still load
- [x] 4.3 Run `openspec validate add-model-metadata --strict` and verify it passes
