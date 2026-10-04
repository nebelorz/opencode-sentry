---
name: quota-watch
description: Use when the user asks about OpenCode Go model quotas, estimated requests, per-model usage limits, model cost/quality comparisons, or recent quota changes (for example "did DeepSeek V4.1 Flash change?"). Fetches the latest snapshot and change report from the opencode-sentry raw GitHub data and reports the facts, then may advise.
---

# Quota Watch

Reports current OpenCode Go model quotas and recent quota changes from the opencode-sentry project.

## Data contract

Base data URL:

```text
https://raw.githubusercontent.com/nebelorz/opencode-sentry/main/data/
```

1. Fetch `<base>latest.json`. It is a pointer:

   ```json
   { "snapshot": "snapshots/<file>.json", "changes": "changes/<file>.json" }
   ```

2. Fetch `<base><snapshot>` for the current state and `<base><changes>` for the latest transition.

If a fetch fails or the JSON does not match the shapes below, say so plainly. Never invent values. Fallback for offline or private use: read the same files from a local clone, starting at `data/latest.json` and resolving the relative paths under `data/`.

## Snapshot shape

```json
{
  "schemaVersion": 1,
  "source": { "provider": "opencode", "plan": "go", "url": "..." },
  "scrapedAt": "2026-09-27T17:38:22.942Z",
  "models": [
    {
      "id": "deepseek-v4.1-flash",
      "name": "DeepSeek V4.1 Flash",
      "estimatedRequests": { "fiveHour": 26000, "weekly": 65000, "monthly": 130000 }
    }
  ]
}
```

`estimatedRequests` values are non-negative integers or the string `"unlimited"`.

## Change report shape

```json
{
  "schemaVersion": 1,
  "from": "2026-09-27T17:21:02.922Z",
  "to": "2026-09-27T17:38:22.942Z",
  "changes": [
    {
      "type": "quota_changed",
      "model": { "id": "grok-4.6", "name": "Grok 4.6" },
      "quota": {
        "period": "fiveHour",
        "previous": 100,
        "current": 169,
        "change": 69,
        "changePercent": 69
      }
    }
  ]
}
```

`type` is one of `model_added`, `model_removed`, or `quota_changed`. Only `quota_changed` entries carry `quota`.

## How to report

- Current quotas: a table of model name and the five-hour, weekly, and monthly estimated requests.
- Latest changes: list `model_added`, `model_removed`, and `quota_changed` entries. For quota changes show previous, current, and the percent when present.
- Always show freshness: the snapshot `scrapedAt` and the change report `from` and `to`. Never present the data as live, because raw GitHub can lag the latest commit by minutes.

## Recommendations (agent side)

- When asked for the "best quality/cost" model or a recommendation, compare models using `estimatedRequests` as a cost-efficiency proxy: for the same plan, a higher estimated-requests value means more usage allowed in that period.
- State clearly that `estimatedRequests` is a quota, not a currency price. The project does not collect per-token prices.
- Make the recommendation yourself from the facts and label it as your judgment. The data itself is facts only.

## Fetching

- Prefer your built-in HTTP or fetch capability.
- PowerShell: `Invoke-RestMethod "https://raw.githubusercontent.com/nebelorz/opencode-sentry/main/data/latest.json"`
- curl: `curl -fsSL <url>`

## Maintenance

The repository copy of this skill is canonical. After editing it, reinstall it to `~/.config/opencode/skills/quota-watch/SKILL.md` and restart OpenCode.
