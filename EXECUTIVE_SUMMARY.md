# Opencode Sentry

## 1. Project Overview

**Opencode Sentry** is a small open-source service that monitors the model quotas published by OpenCode Go.

Its primary purpose is to detect changes in the **Estimated Requests** table published in the official OpenCode documentation, particularly:

* Models being added or removed.
* Changes to 5-hour request quotas.
* Changes to weekly request quotas.
* Changes to monthly request quotas.

The project should make these facts available in a machine-readable format so that both humans and AI agents can inspect the current quotas and recent changes.

The system should **provide data, not recommendations**. An AI agent can use the data to decide which model is appropriate for a particular task.

---

## 2. Problem

OpenCode Go model quotas can change over time.

A model that was previously viable for frequent use may later receive a substantially lower quota. Without historical monitoring, these changes can go unnoticed.

The project should therefore provide:

1. A reliable current snapshot of OpenCode Go model quotas.
2. A historical record of previous snapshots.
3. A machine-readable description of changes between snapshots.
4. A simple public API that agents and other applications can consume.

---

## 3. MVP Scope

The MVP consists of four main components:

```text
OpenCode documentation
        │
        ▼
GitHub Actions
        │
        ├── Fetch
        ├── Parse
        ├── Validate
        ├── Snapshot
        └── Diff
             │
             ▼
       JSON data in Git
             │
             ▼
   raw.githubusercontent.com
             │
             ▼
   OpenCode skill / agent
```

### Included in MVP

* Scraping the official OpenCode Go documentation.
* Extracting the **Estimated Requests** table.
* Validating the extracted data.
* Creating immutable JSON snapshots.
* Detecting changes between consecutive snapshots.
* Storing snapshots in Git.
* Storing generated change reports in Git.
* Running the collector twice per day through GitHub Actions.
* Committing a `data/latest.json` pointer to the newest snapshot and change report.
* Exposing the current snapshot and latest changes as JSON over raw GitHub.
* Automated tests for parsing, validation and diff logic.

### Explicitly out of MVP

The following should **not** be implemented initially:

* SPA/dashboard.
* Database.
* Authentication.
* User accounts.
* Webhooks or notifications.
* CLI.
* Public HTTP API or deployed service.
* Cloudflare Worker or other serverless runtime.
* OpenCode plugin.
* AI model recommendation endpoint.
* Model capability/ranking system.
* Complex API filtering.
* R2/KV or other external storage unless implementation requires it.
* Monorepo structure.
* Premature abstractions.

These may be considered later as separate OpenSpec changes.

---

## 4. Data Source

The authoritative source for quota information is the official OpenCode Go documentation:

https://opencode.ai/v2/docs/console/go#estimated-requests

OpenCode also exposes an endpoint containing model metadata:

```text
/zen/go/v1/models
```

However, the model metadata endpoint does not provide the **Estimated Requests** quota information required by this project.

Therefore, the MVP should treat the official documentation table as the source of truth for quota data.

If OpenCode provides a suitable structured quota source in the future, the collector can be adapted to use it.

---

## 5. Collection Frequency

The collector should run twice per day:

```text
00:15 UTC
12:15 UTC
```

GitHub Actions is responsible for scheduling the collection.

The exact workflow configuration should be implemented as part of the relevant OpenSpec change rather than this document.

---

## 6. Snapshot Storage

Snapshots are stored directly in the Git repository.

Proposed structure:

```text
data/
├── snapshots/
│   ├── 2026-09-27T00-15.json
│   └── 2026-09-27T12-15.json
└── changes/
    └── 2026-09-27T12-15.json
```

Snapshots are immutable.

Existing historical snapshots must never be modified by later collection runs.

Git provides:

* Historical records.
* Change tracking.
* Auditability.
* Rollback.
* A simple initial storage mechanism without requiring a database.

---

## 7. Snapshot Model

A snapshot represents the state of OpenCode Go quotas at a specific point in time.

Example:

```json
{
  "schemaVersion": 1,
  "source": {
    "provider": "opencode",
    "plan": "go",
    "url": "https://opencode.ai/v2/docs/console/go"
  },
  "scrapedAt": "2026-09-27T12:15:00Z",
  "models": [
    {
      "id": "deepseek-v4-flash",
      "name": "DeepSeek V4 Flash",
      "estimatedRequests": {
        "fiveHour": 13000,
        "weekly": 32500,
        "monthly": 65000
      }
    }
  ]
}
```

### Principles

* `schemaVersion` allows the schema to evolve.
* Timestamps use ISO 8601 and UTC.
* Model IDs should be stable identifiers.
* Model names are human-readable values.
* Quota values should use numeric values where possible.
* If the source provides an unlimited value, the representation should be defined during implementation rather than using JavaScript-specific values such as `Infinity`.
* Snapshot data should represent state only.
* Change information belongs in the change report, not inside snapshots.

---

## 8. Validation

External data must be validated before being committed.

The collector must not publish a snapshot if:

* The source cannot be fetched.
* The expected table cannot be found.
* The table contains no valid models.
* Required columns are missing.
* Values cannot be parsed correctly.
* The resulting data does not satisfy the snapshot schema.

A failed collection should fail the GitHub Actions job rather than silently publishing incomplete or incorrect data.

Zod is the preferred validation library unless implementation reveals a strong reason to use another approach.

---

## 9. Parsing Strategy

The collector should parse the table based on its semantic structure rather than relying on fragile styling or visual selectors.

The parser should:

1. Locate the **Estimated Requests** section.
2. Identify the associated table.
3. Read column headers.
4. Map model rows to the snapshot schema.
5. Normalize quota values.
6. Validate the final result.

The parser should be tested against representative HTML fixtures.

The implementation should assume that the documentation HTML structure may change in the future.

A parsing failure should therefore be treated as an error rather than attempting to publish potentially incorrect data.

---

## 10. Diff Generation

The diff is calculated during the collection process, not by the API.

Each successful scrape compares the new snapshot with the previous snapshot.

The MVP detects three types of changes:

### `model_added`

A model exists in the new snapshot but not in the previous snapshot.

### `model_removed`

A model existed in the previous snapshot but no longer exists in the new snapshot.

### `quota_changed`

A model exists in both snapshots but one or more quota values changed.

For quota changes, the report should include:

* Model.
* Quota period.
* Previous value.
* Current value.
* Absolute change.
* Percentage change where mathematically meaningful.

Example:

```json
{
  "schemaVersion": 1,
  "from": "2026-09-27T00:15:00Z",
  "to": "2026-09-27T12:15:00Z",
  "changes": [
    {
      "type": "quota_changed",
      "model": {
        "id": "glm-5.2",
        "name": "GLM-5.2"
      },
      "quota": {
        "period": "weekly",
        "previous": 2150,
        "current": 1000,
        "change": -1150,
        "changePercent": -53.49
      }
    }
  ]
}
```

The MVP should not introduce configurable thresholds or severity levels.

---

## 11. Data Interface

There is no server. Consumers read committed JSON directly from Git.

### Latest pointer

`data/latest.json` is the stable entry point and identifies the newest snapshot and change report by relative path.

### Current state

The referenced snapshot under `data/snapshots/` represents the **current state** of OpenCode Go quotas.

### Latest transition

The referenced change report under `data/changes/` represents the **latest transition**.

For a public repository these files are served over raw GitHub, for example:

```text
https://raw.githubusercontent.com/nebelorz/opencode-sentry/main/data/latest.json
https://raw.githubusercontent.com/nebelorz/opencode-sentry/main/data/snapshots/<file>.json
https://raw.githubusercontent.com/nebelorz/opencode-sentry/main/data/changes/<file>.json
```

The interface is read-only by construction. No API endpoints, filtering, or query parameters are provided.

---

## 12. Delivery Architecture

Delivery is intentionally thin.

```text
GitHub Actions (scheduled)
       │
       ▼
collect -> diff -> latest
       │
       ▼
JSON data committed to Git
       │
       ▼
raw.githubusercontent.com
       │
       ▼
OpenCode skill / agent
```

The delivery layer must **not**:

* Scrape OpenCode.
* Parse OpenCode HTML.
* Calculate diffs.
* Contain quota business logic.

Those responsibilities belong to the collection pipeline.

The delivery layer only commits already validated JSON and serves it over Git.

---

## 13. Technology Stack

The initial stack is:

| Area            | Technology           |
| --------------- | -------------------- |
| Language        | TypeScript           |
| Runtime         | Node.js              |
| Package manager | pnpm                 |
| Collector       | Node.js / TypeScript |
| HTML parsing    | Cheerio              |
| Validation      | Zod                  |
| Testing         | Vitest               |
| Delivery        | Committed JSON over raw GitHub |
| Scheduling      | GitHub Actions       |
| Storage/history | Git repository       |
| Formatting      | Prettier             |
| Linting         | ESLint               |

Dependencies should remain minimal.

Existing platform capabilities should be preferred over introducing additional infrastructure.

---

## 14. Repository Structure

The project should start as a **single repository**, not a monorepo.

The exact structure should be established by the `project-scaffolding` OpenSpec change.

A likely structure is:

```text
opencode-quota-watch/
├── src/
│   ├── collector/
│   ├── diff/
│   ├── cli/
│   └── schema/
├── data/
│   ├── snapshots/
│   └── changes/
├── tests/
├── openspec/
├── .github/
│   └── workflows/
├── AGENTS.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
└── README.md
```

This structure is guidance, not a requirement to create every directory immediately.

Do not create empty abstractions or folders solely for architectural symmetry.

---

## 15. Architecture Principles

The project should follow these principles:

* Prefer simple, readable code over abstraction.
* Avoid premature generalization.
* Avoid unnecessary design patterns.
* Keep modules small and focused.
* Keep scraping logic independent from diff logic.
* Keep business logic independent from HTTP.
* Keep API code thin.
* Validate all externally sourced data.
* Never silently publish partial data.
* Preserve historical data.
* Use UTC consistently.
* Prefer existing project tooling over additional dependencies.
* Keep the MVP small.

The core pipeline is:

```text
Collector
   ↓
Validated Snapshot
   ↓
Diff
   ↓
JSON Data
   ↓
API
```

---

## 16. OpenSpec Development Strategy

OpenSpec should be used to develop the project incrementally.

The project should not be implemented as one large change.

Initial changes:

### 1. `project-scaffolding`

Create the project foundation:

* TypeScript.
* pnpm.
* Testing.
* Linting.
* Formatting.
* OpenSpec.
* AGENTS.md.
* Basic repository structure.
* Basic GitHub Actions structure where appropriate.

No scraper implementation.

### 2. `opencode-quota-scraper`

Implement:

* OpenCode documentation fetching.
* HTML parsing.
* Normalization.
* Validation.
* Snapshot generation.
* Tests.

### 3. `snapshot-diff`

Implement:

* Previous snapshot loading.
* Model added/removed detection.
* Quota change detection.
* Change report generation.
* Tests.

### 4. `latest-pointer`

Implement:

* Selection of the newest snapshot and change report.
* Generation of `data/latest.json` for Git and raw GitHub consumption.
* Validation and tests.

The earlier `public-api` change was removed by `remove-public-api`; there is no HTTP API.

### 5. `scheduled-collection`

Implement:

* GitHub Actions collection workflow.
* Automatic snapshot/change commits.
* Latest-pointer regeneration.
* Required permissions/configuration.
* Production validation.

### 6. `opencode-integration`

Only after the core system is stable:

* Global OpenCode skill (`quota-watch`).
* Agent-facing usage documentation.
* Integration tests where useful.

Each change should remain focused and independently testable.

---

## 17. OpenCode Agent Integration

A goal is to make Quota Watch useful directly from OpenCode agents.

The committed data provides facts such as:

```text
Current model quotas
Recent quota changes
New models
Removed models
```

The agent should make the actual model-selection decision.

Quota Watch should not initially implement logic such as:

```text
"Always use model X"
"Model Y is the best"
"Choose model Z for coding"
```

That would mix data collection with model-selection policy.

The `opencode-integration` change adds the global OpenCode skill `quota-watch`, which reads the data over raw GitHub and reports current quotas and recent changes. The agent makes the actual model-selection decision.

---

## 18. Future Possibilities

The following are possible future extensions, but are not part of the MVP:

* Historical API queries.
* Filtering by model or quota period.
* Web dashboard.
* Charts and historical quota visualization.
* Notifications.
* Discord/Slack integrations.
* CLI.
* OpenCode plugin.
* OpenCode skill.
* Model capability metadata.
* Task-oriented model recommendations.
* Additional OpenCode plans.
* Additional data sources.
* Persistent external storage if Git becomes insufficient.

Each future feature should be evaluated independently and introduced through OpenSpec.

---

## 19. Non-Goals

Quota Watch is not intended to:

* Replace OpenCode's official documentation.
* Track individual user usage.
* Access private OpenCode accounts.
* Predict future quota changes.
* Decide which model an agent must use.
* Provide an AI model-ranking service in the MVP.
* Become a general-purpose model marketplace or registry.

Its core responsibility is simple:

> **Track OpenCode Go model quota data over time and make current state and recent changes easily consumable by humans and machines.**

---

## 20. Initial Success Criteria

The MVP is considered successful when:

1. The collector can reliably retrieve the official OpenCode Go quota table.
2. The parsed data passes schema validation.
3. A valid snapshot is stored in Git.
4. A second snapshot can be compared with the first.
5. Model additions/removals are detected.
6. Quota changes are detected with numerical differences.
7. The latest snapshot is available as committed JSON referenced by `data/latest.json`.
8. The latest diff is available as committed JSON referenced by `data/latest.json`.
9. GitHub Actions can run the collection automatically.
10. The system fails safely when the source format changes.
11. The project remains small, readable and easy to maintain.

---

## 21. Guiding Principle

The project should start as a **small data pipeline**, not as a large application.

Build the smallest reliable system that answers two questions:

```text
What are the current OpenCode Go quotas?

What changed since the previous check?
```

Everything else should be added only when there is a concrete need.
