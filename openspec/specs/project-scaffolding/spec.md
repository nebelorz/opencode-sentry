# project-scaffolding Specification

## Purpose
Establishes the verified technical foundation for the project: a single pnpm and TypeScript package that installs, typechecks, lints, formats, tests, and builds a stub Cloudflare Worker, with Git and continuous integration configured.

## Requirements

### Requirement: Project installs reproducibly

The project SHALL install as a single package using pnpm, with the package manager version pinned and a committed lockfile.

#### Scenario: Clean install

- **WHEN** a contributor runs `pnpm install` in a clean checkout
- **THEN** dependencies install from the committed lockfile without errors
- **AND** the pinned package manager version is declared in `package.json`

### Requirement: TypeScript typechecks

The project SHALL provide a typecheck command that validates all TypeScript sources for the Node collector runtime without errors.

#### Scenario: Typecheck passes

- **WHEN** a contributor runs `pnpm typecheck`
- **THEN** TypeScript reports no type errors

### Requirement: Automated tests run

The project SHALL provide a test command backed by Vitest, and it SHALL include at least one test so the command does not fail for lack of tests.

#### Scenario: Test command succeeds

- **WHEN** a contributor runs `pnpm test`
- **THEN** Vitest executes the smoke test and reports success
- **AND** the command fails if the test fails

### Requirement: Code style is enforceable

The project SHALL provide ESLint and Prettier as the linting and formatting tools, exposed through commands that fail on violations.

#### Scenario: Lint passes

- **WHEN** a contributor runs `pnpm lint`
- **THEN** ESLint reports no errors on the sources

#### Scenario: Format check passes

- **WHEN** a contributor runs `pnpm format:check`
- **THEN** Prettier reports no unformatted files

### Requirement: Stub Cloudflare Worker builds

The project SHALL include a `wrangler.jsonc` configuration and a minimal Hono-based Worker entry that builds without publishing and exposes no API routes.

#### Scenario: Worker builds without deploying

- **WHEN** a contributor runs the Worker build command (a Wrangler dry run)
- **THEN** Wrangler validates `wrangler.jsonc` and builds the stub Worker
- **AND** no deployment or publication occurs

### Requirement: Repository history is tracked in Git

The project SHALL be a Git repository with a `main` default branch and a `.gitignore` that excludes dependency, build, and local secret artifacts.

#### Scenario: Git is configured

- **WHEN** the repository is inspected
- **THEN** it is a Git repository whose default branch is `main`
- **AND** `.gitignore` excludes installed dependencies, build output, and local environment files

### Requirement: Continuous integration validates changes

The project SHALL run lint, typecheck, and test in GitHub Actions on every push and pull request, failing when any step fails.

#### Scenario: Push or pull request triggers validation

- **WHEN** a commit is pushed or a pull request is opened
- **THEN** CI installs dependencies with the pinned package manager and runs lint, typecheck, and test
- **AND** the workflow fails if any step fails

#### Scenario: CI does not publish or deploy

- **WHEN** the CI workflow runs
- **THEN** it performs no collection, publishing, or deployment step

### Requirement: Foundation scope stays minimal

The foundation SHALL contain only setup and tooling; it SHALL NOT include scraping, parsing, validation, snapshot, diff, or API route behavior.

#### Scenario: No pipeline behavior is present

- **WHEN** this change is complete
- **THEN** no scraper, parser, Zod validation, snapshot generation, diff, API endpoint, scheduled collection, or deployment behavior exists in the codebase
