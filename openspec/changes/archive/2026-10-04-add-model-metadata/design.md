## Context

See proposal.md - Why. models.dev exposes a single JSON catalog at `https://models.dev/api.json` keyed by provider id, and its `opencode-go` provider uses the same model ids as the Go Endpoints table. The catalog entries include `limit.context`, `limit.output`, `modalities`, capability booleans, `family`, `knowledge`, `release_date`, `open_weights`, and `canonical_model_id`, plus provider-level fields such as `api`, `env`, and `npm` that describe how to call the provider and must not be stored. The snapshot schema is additive with optional fields (`pricing` from `add-go-pricing`), and the diff loader re-validates every historical snapshot.

## Goals / Non-Goals

**Goals:**

- Attach verified context and capability metadata to matched models.
- Match deterministically by exact model id.
- Stay additive and backward compatible, and keep the diff and API untouched.

**Non-Goals:**

- Benchmarks or quality scores. models.dev provides none, and benchmarks remain a disclosed gap.
- Storing provider routing or endpoint information.
- Fetching metadata at review time; it is committed in the snapshot.
- Re-ranking models by capability. Ranking is already handled by `add-go-pricing`.

## Decisions

**`https://models.dev/api.json` fetched once, then the `opencode-go` provider selected.**
models.dev publishes one catalog document rather than a stable per-provider endpoint, so the stage fetches it once per run and selects the provider. Alternative considered: per-provider endpoints; rejected because they are not a documented stable contract. Trade-off: the catalog is large, but it is fetched once and not stored.

**A dedicated `model-metadata` capability and module, invoked during collection.**
The enrichment lives in `src/metadata/` and is invoked by the collection pipeline after the base snapshot is assembled and before validation and persistence, so a single committed snapshot carries quota, pricing, and metadata. Alternative considered: a separate CLI stage and a separate file; rejected because the snapshot is the committed unit and the review reads the snapshot.

**Optional `metadata` per model, omitted when unmatched.**
A model with no catalog entry is persisted without `metadata`; the absence means not collected. Alternative considered: fail the collection on a missing entry; rejected by product choice so one unmatched model does not block the whole snapshot. `schemaVersion` stays `1`, consistent with `add-go-pricing`.

**Exact, case-sensitive id match within `opencode-go`.**
The Go Endpoints table already uses the models.dev ids, so an exact match is reliable and deterministic. Alternative considered: normalized-name matching; rejected because ids are available and names include variant qualifiers.

**Store only selected fields, validated before persistence.**
The stage maps the catalog entry to a small, typed `metadata` object and validates it. Context and output limits are required when metadata is present; the remaining selected fields are stored when the catalog provides them. Alternative considered: store the whole catalog entry; rejected because it would persist provider endpoint and routing fields that must not be stored.

**Offline fixtures plus an opt-in live check.**
Tests use a saved catalog fixture and never call models.dev, matching the project's existing collector test pattern.

## Risks / Trade-offs

- [models.dev is unavailable or slow] -> The catalog fetch fails loudly, no snapshot is written, and the last good snapshot remains in place.
- [models.dev schema drift] -> Only a small, typed set of fields is read and validated; an invalid selected field aborts the enrichment rather than persisting bad data.
- [Go ids drift from models.dev ids] -> The unmatched model is omitted and disclosed; ids are stable in practice and the failure is visible in the snapshot.
- [Optional metadata is mistaken for real data when absent] -> Absence is defined to mean not collected, and the review is required to state per-model absence.

## Migration Plan

No data migration. Historical snapshots stay valid and loadable. Deploy the collector with the enrichment stage, run `pnpm collect` to publish a snapshot with metadata, then update the skill. Rollback is reverting the collector and skill; committed snapshots are immutable.
