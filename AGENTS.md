# AGENTS.md

## Principles

- Prefer simple, readable code over abstraction.
- Do not introduce abstractions without a concrete need.
- Avoid over-engineering; build the smallest reliable solution.
- Keep modules small and single-purpose.
- Avoid duplication, but do not prematurely generalize.
- Keep business logic independent from HTTP and scraping concerns.
- Validate all externally sourced data before publishing it.
- Do not silently publish partial or malformed snapshots.
- Use UTC for timestamps and scheduling.
- Preserve historical snapshots; never mutate existing snapshots.
- Prefer existing project tooling over adding dependencies.

## Language and Tooling

- Write code in TypeScript.
- Use pnpm as the package manager.
- Use the existing project tooling for testing, linting, formatting, and building.

## Architecture

Collector -> validated snapshot -> diff -> JSON data -> API.

- Keep the collector, diff, and API concerns separate.
- The API must not contain scraping or diff logic.

## Changes

- Use OpenSpec for non-trivial changes.
- Before implementation, inspect the relevant spec or change.
- Keep changes focused and independently testable.
