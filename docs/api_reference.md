# ExfSafeGrid Wildfire Ops & PSPS API Reference

Base URL: `http://your-host:8000`
Auth: `X-API-Key: <your-key>` header (if API_KEY is set in .env)
Interactive docs: `http://your-host:8000/docs`

---

## Predictions

### GET /psa-risk

**Model A**: PSA/Circuit wildfire activity risk (1–3 month horizon).

| Param | Type | Default | Description |
|---|---|---|---|
| `month_offset` | int | 1 | Horizon: 1=Month1, 2=Month2, 3=Month3 |
| `psa_id` | string | — | Filter by PSA ID |
| `min_prob` | float | 0.0 | Minimum prob_above_normal (0–1) |
| `prediction_date` | date | today | Scoring date |
| `limit` | int | 100 | Max results |

**Response**:
```json
{
  "prediction_date": "2025-07-15",
  "horizon": "Month1",
  "model": "psa_risk",
  "count": 42,
  "results": [
    {
      "circuit_id": "C001",
      "psa_id": "CA-S",
      "prob_above_normal": 0.782,
      "risk_bucket": "HIGH",
      "drivers": {"fp_7day_max": 0.32, "erc_max": 0.28, ...},
      "hftd_tier": 3,
      "customer_count": 4200,
      "county": "San Diego"
    }
  ]
}
```

---

### GET /circuit-ignition-risk

**Model B**: Circuit ignition spike risk for 24h, 48h, or 72h horizon.

| Param | Type | Default | Description |
|---|---|---|---|
| `horizon_hours` | int | 24 | 24 \| 48 \| 72 |
| `circuit_id` | string | — | Filter to one circuit |
| `psa_id` | string | — | Filter by PSA |
| `min_prob` | float | 0.0 | Minimum prob_spike |
| `risk_band` | string | — | LOW \| MODERATE \| HIGH \| CRITICAL |
| `prediction_date` | date | today | |
| `limit` | int | 100 | |

**Response**:
```json
{
  "prediction_date": "2025-07-15",
  "horizon_hours": 24,
  "model": "ignition_spike",
  "count": 18,
  "results": [
    {
      "circuit_id": "C042",
      "psa_id": "CA-N",
      "prob_spike": 0.841,
      "risk_band": "CRITICAL",
      "drivers": {"ffwi_max": 0.41, "fp_7day_d1": 0.35, ...},
      "hftd_tier": 3,
      "customer_count": 1850,
      "critical_customers": 12
    }
  ]
}
```

---

## Agents

### GET /briefing

Retrieve the latest (or specified date) daily ops briefing.

| Param | Type | Default |
|---|---|---|
| `briefing_date` | date | today |

**Response**:
```json
{
  "briefing_date": "2025-07-15",
  "markdown_text": "# Wildfire Ops & PSPS Daily Briefing...",
  "structured_data": {...},
  "model_used": "claude-sonnet-4-6",
  "tokens_used": 1243,
  "created_at": "2025-07-15T07:00:00Z"
}
```

### POST /briefing/generate

Generate a new briefing via the Ops Briefing Agent (calls Claude).

```json
{ "date": "2025-07-15", "overwrite": false }
```

---

### GET /psps-watchlist

Retrieve the latest PSPS watchlist.

| Param | Type | Default |
|---|---|---|
| `watchlist_date` | date | today |
| `horizon` | string | "24h" |

**Response**:
```json
{
  "watchlist_date": "2025-07-15",
  "horizon": "24h",
  "markdown_text": "## PSPS Watchlist...",
  "structured_data": {
    "watchlist": [
      {
        "rank": 1,
        "circuit_id": "C042",
        "risk_bucket": "CRITICAL",
        "prob_spike": 0.841,
        "recommended_action": "DE-ENERGIZE",
        "trigger_rationale": "FFWI >45, HFTD Tier 3, active fire 12mi NE",
        "customer_count": 1850,
        "critical_customers": 12
      }
    ],
    "immediate_actions": ["Deploy field crews to C042", "..."],
    "summary": "..."
  }
}
```

### POST /psps-watchlist/generate

```json
{ "date": "2025-07-15", "horizon": "24h", "overwrite": false }
```

---

## Live Data

### GET /incidents/active

Currently active NIFC wildfire incidents.

| Param | Type | Default |
|---|---|---|
| `state` | string | — | e.g. "CA" |
| `psa_id` | string | — | |
| `min_acres` | float | 0 | |
| `limit` | int | 50 | |

### GET /perimeters/current

Latest perimeter snapshot per incident (most recent `date_current`).

| Param | Type | Default |
|---|---|---|
| `incident_id` | string | — | |
| `min_acres` | float | 0 | |

### GET /outlooks/7day

7-Day fire potential outlook by PSA.

| Param | Type | Default | Description |
|---|---|---|---|
| `period_label` | string | "Day1" | Day1–Day7 |
| `psa_id` | string | — | |
| `min_potential` | int | 1 | 1=BelowNormal … 5=ExtremelyCritical |
| `forecast_date` | date | today | |

### GET /outlooks/monthly

Monthly/Extended outlook by PSA.

| Param | Type | Default |
|---|---|---|
| `period_label` | string | "Month1" | Month1–Month4 |
| `min_potential` | int | 1 | |

---

## Management

### POST /models/train

Trigger model retraining.

```json
{ "model": "both", "synthetic": false }
```

`model`: `"psa_risk"` | `"ignition_spike"` | `"both"`
`synthetic`: `true` for Phase 1 bootstrap (no historical labels needed)

### POST /models/score

Score all circuits and write to model_predictions.

```json
{ "model": "both", "prediction_date": "2025-07-15" }
```

### GET /ingestion/status

Summary of ingestion runs in the last 24h.

### POST /ingestion/trigger/{source}

Manual ingestion trigger. Sources:

- `perimeters` — Wildfire perimeters
- `incidents` — Active incidents
- `outlook_7day` — 7-Day outlooks
- `outlook_monthly` — Monthly outlooks
- `raws` — RAWS observations

---

## Error Responses

| Code | Meaning |
|---|---|
| 400 | Bad request / invalid param |
| 403 | Invalid API key |
| 404 | No data found for requested date |
| 500 | Internal error (check logs) |

All errors return: `{ "detail": "error message" }`

---

## Risk Bucket Definitions

| Bucket | Prob Threshold | Description |
|---|---|---|
| LOW | < 0.30 | Routine monitoring |
| MODERATE | 0.30–0.50 | Elevated awareness |
| HIGH | 0.50–0.70 | Active watch, prep crews |
| CRITICAL | ≥ 0.70 | Consider de-energization |

## Fire Potential Scale (NIFC)

| Value | Label |
|---|---|
| 1 | Below Normal |
| 2 | Normal |
| 3 | Above Normal |
| 4 | Critical |
| 5 | Extremely Critical |
