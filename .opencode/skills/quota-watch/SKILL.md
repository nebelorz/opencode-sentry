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
      "estimatedRequests": { "fiveHour": 26000, "weekly": 65000, "monthly": 130000 },
      "pricing": [
        {
          "plan": "go",
          "variant": "off-peak",
          "variantLabel": "Off-Peak",
          "input": 0.15,
          "output": 0.6,
          "cachedRead": 0.003,
          "cachedWrite": null,
          "monthlyLimit": { "amount": 60, "currency": "USD" }
        },
        {
          "plan": "go-plus",
          "variant": "default",
          "variantLabel": "Default",
          "input": 0.15,
          "output": 0.6,
          "cachedRead": 0.003,
          "cachedWrite": null,
          "monthlyLimit": "unlimited"
        }
      ],
      "metadata": {
        "contextLimit": 1000000,
        "outputLimit": 384000,
        "modalities": { "input": ["text", "image"], "output": ["text"] },
        "capabilities": {
          "attachment": true,
          "reasoning": true,
          "toolCall": true,
          "structuredOutput": true,
          "temperature": true,
          "openWeights": true
        },
        "family": "deepseek-flash",
        "knowledgeCutoff": "2025-05",
        "releaseDate": "2026-09-10",
        "canonicalModelId": "deepseek/deepseek-v4.1-flash"
      }
    }
  ]
}
```

`estimatedRequests` values are non-negative integers or the string `"unlimited"`.

`pricing` is optional and may be absent on an older snapshot. When present, each entry is one plan and price variant:

- `plan` is `"go"` or `"go-plus"`.
- `variant` is a normalized key (`"default"`, `"peak"`, `"off-peak"`, or a token-tier key such as `"le-256k"`); `variantLabel` is the source label. A model and plan may have several variants.
- `input`, `output`, `cachedRead`, and `cachedWrite` are USD per 1M tokens. `cachedRead` and `cachedWrite` may be `null` when the source has no price.
- `monthlyLimit` is `{ "amount": <number>, "currency": "USD" }` or the string `"unlimited"`.

`metadata` is optional and may be absent on an older snapshot or when the model has no catalog entry. When present, it holds validated model facts:

- `contextLimit` and `outputLimit` are non-negative integer token counts.
- `modalities` is `{ "input": [...], "output": [...] }` with values such as `"text"`, `"image"`, `"audio"`, and `"video"`.
- `capabilities` holds boolean flags: `attachment`, `reasoning`, `toolCall`, `structuredOutput`, `temperature`, and `openWeights`. A flag may be absent when the source did not provide it.
- `family`, `knowledgeCutoff`, `releaseDate`, and `canonicalModelId` are optional strings.

The absence of `metadata` for a model means the metadata was not collected. Never invent context, limits, modalities, or capabilities for that model.

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

## Review (agent side)

When the user asks which model is the best value or for a recommendation, produce a value-tier review: facts first, opinions labeled.

### Value tiers

- Rank models using the committed token prices and monthly limits, and you may use monthly `estimatedRequests` as a usage-volume proxy. For the same plan, lower per-token prices and a higher monthly limit mean more usage per dollar.
- Group models into tiers derived from the observed distribution rather than fixed constants. The tier boundaries are your judgment, not project data.
- Treat a monthly `estimatedRequests` or monthly limit of `"unlimited"` as the most permissive: show it as `unlimited`, never as a number, and do not compare it numerically.
- Rank only from values present in the committed snapshot. Do not introduce any price, cost, or quantity that is not in the data.

### Allowance rule

- Explain that each model's quota is one monthly allowance shown at three horizons: a 5-hour value at roughly 20 percent, a weekly value at roughly 50 percent, and a monthly value at 100 percent of the allowance.
- State clearly that `estimatedRequests` is a usage quota, not a currency price. The token prices and the monthly limit in USD are collected separately and attached to each model's `pricing`.

### Committed pricing

- Present cost using the committed per-token prices and monthly limits from each model's `pricing` entries.
- Show the committed prices for each available plan (`go` and `go-plus`). Distinguish variants (for example peak and off-peak, or token tiers) instead of collapsing them into one price.
- Show the model's monthly limit in USD, or `unlimited` when the source says so.
- If a model, plan, or variant has no committed price, state that it is not available. Never invent a price.

### Committed metadata

- Present each model's committed `metadata` as facts: context window (`contextLimit`), output limit (`outputLimit`), input and output modalities, and capability flags.
- Report metadata per model. Do not carry one model's metadata over to another model.
- If a model has no `metadata`, state that metadata is not available for that model. Never supply an estimated or remembered value.

### Quality judgment

- You may describe how capable or suitable a model is, but label that description as your judgment, not project data.
- Committed metadata such as context window, output limit, modalities, and capability flags are facts and may be presented as data.
- The committed data contains no quality or benchmark values. Never present a quality score or benchmark number as if it came from the data.

### Data gaps

- State that the committed data does not include benchmark results. Per-model token prices, monthly limits, context window, and capabilities are collected when the source provides them and are not global gaps.
- When an individual model has no committed metadata, say that metadata is not available for that model instead of reporting the whole category as missing.
- Mark any missing fact as not collected. Never fill a gap with an estimated, guessed, or remembered value presented as data.

### Output shape

- Present value tiers, facts first, then a short recommendation of a few lines at most.
- Label the tier boundaries and the recommendation as your judgment.
- List the data gaps named above so the user knows what the review cannot cover.

## Fetching

- Prefer your built-in HTTP or fetch capability.
- PowerShell: `Invoke-RestMethod "https://raw.githubusercontent.com/nebelorz/opencode-sentry/main/data/latest.json"`
- curl: `curl -fsSL <url>`

## Maintenance

The repository copy of this skill is canonical. After editing it, reinstall it to `~/.config/opencode/skills/quota-watch/SKILL.md` and restart OpenCode.
