# ExfSafeGrid Wildfire Ops & PSPS Backend — Setup Guide v2

## Prerequisites

- Python 3.11+ (or Docker)
- PostgreSQL 14+ with **PostGIS 3.x** extension (or Docker)
- Anthropic API key

---

## Option A: Docker (Recommended)

```bash
git clone https://github.com/your-org/exf-wildfire-ops-psps.git
cd exf-wildfire-ops-psps

# Set required env vars
export ANTHROPIC_API_KEY=sk-ant-...
export API_KEY=your-secret-key
export POSTGRES_PASSWORD=your-db-password

# Build and start (DB + API + scheduler)
docker-compose up -d

# Check health
curl http://localhost:8000/health
```

The schema is applied automatically on first start via `docker-entrypoint-initdb.d`.

---

## Option B: Local Python

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit with your values

# Create DB
psql -U postgres -c "CREATE DATABASE exf_wildfire;"
psql -U postgres -d exf_wildfire -c "CREATE EXTENSION postgis;"
psql -U postgres -d exf_wildfire -c 'CREATE EXTENSION "uuid-ossp";'
psql -U postgres -d exf_wildfire -f docs/schema.sql

python run.py   # starts API + scheduler
```

---

## Quickstart After Installation

### Step 1 — Bootstrap ingestion (run once)

```bash
python scripts/run_ingestion.py --once
```

Or trigger via API:

```bash
curl -X POST http://localhost:8000/ingestion/trigger/perimeters    -H "X-API-Key: your-key"
curl -X POST http://localhost:8000/ingestion/trigger/incidents      -H "X-API-Key: your-key"
curl -X POST http://localhost:8000/ingestion/trigger/outlook_7day   -H "X-API-Key: your-key"
curl -X POST http://localhost:8000/ingestion/trigger/outlook_monthly -H "X-API-Key: your-key"
curl -X POST http://localhost:8000/ingestion/trigger/raws            -H "X-API-Key: your-key"
```

### Step 2 — Load utility circuit data

```bash
# From CSV
psql -d exf_wildfire -c "\COPY utility_circuits (circuit_id, circuit_name, voltage_kv, psa_id, county, state, hftd_tier, length_miles, customer_count) FROM 'circuits.csv' CSV HEADER;"
```

### Step 3 — Train models (Phase 1 bootstrap with synthetic data)

```bash
curl -X POST http://localhost:8000/models/train \
  -H "X-API-Key: your-key" -H "Content-Type: application/json" \
  -d '{"model": "both", "synthetic": true}'
```

### Step 4 — Score circuits

```bash
curl -X POST http://localhost:8000/models/score \
  -H "X-API-Key: your-key" -H "Content-Type: application/json" \
  -d '{"model": "both"}'
```

### Step 5 — Generate briefing

```bash
curl -X POST http://localhost:8000/briefing/generate \
  -H "X-API-Key: your-key" -H "Content-Type: application/json" -d '{}'
```

### Step 6 — Generate PSPS watchlist

```bash
curl -X POST http://localhost:8000/psps-watchlist/generate \
  -H "X-API-Key: your-key" -H "Content-Type: application/json" \
  -d '{"horizon": "24h"}'
```

---

## Ingestion Scripts (run standalone)

```bash
# One source at a time
python ingestion/fetch_perimeters.py
python ingestion/fetch_active_incidents.py
python ingestion/fetch_psa_outlooks.py
python ingestion/fetch_raws_stations.py

# Master script (continuous scheduling)
python scripts/run_ingestion.py

# Master script (once, all sources)
python scripts/run_ingestion.py --once

# Master script (custom intervals)
python scripts/run_ingestion.py \
  --perimeter-interval 600 \
  --outlook-interval 3600 \
  --raws-interval 7200
```

---

## Train Models Directly

```bash
# Model A: PSA activity risk
python models/train_psa_risk.py --lookback-days 730

# Model B: ignition spike (bootstrap with synthetic data)
python models/train_ignition_spike.py --synthetic
```

---

## Daily Automation (cron)

```cron
# Score circuits daily 06:00 UTC
0 6 * * * curl -X POST http://localhost:8000/models/score -H "X-API-Key: $KEY" -d '{"model":"both"}'

# Generate briefing daily 06:30 UTC
30 6 * * * curl -X POST http://localhost:8000/briefing/generate -H "X-API-Key: $KEY" -d '{}'

# Generate PSPS watchlist daily 07:00 UTC
0 7 * * * curl -X POST http://localhost:8000/psps-watchlist/generate -H "X-API-Key: $KEY" -d '{"horizon":"24h"}'
```

---

## Project Structure

```
exf-wildfire-ops-psps/
├── Dockerfile
├── docker-compose.yml
├── run.py                        # server entry point
├── requirements.txt
├── .env.example
├── SETUP.md
│
├── api/
│   └── main.py                   # All FastAPI endpoints
│
├── agents/
│   ├── ops_briefing_agent.py     # Daily briefing (Claude)
│   └── psps_planning_agent.py    # PSPS watchlist (Claude)
│
├── config/
│   ├── database.py
│   └── settings.py
│
├── docs/
│   ├── schema.sql                # Full PostGIS schema
│   ├── api_reference.md          # Endpoint reference
│   ├── exfsafegrid_integration.md # Lovable integration guide
│   └── phase2_roadmap.md
│
├── features/
│   └── feature_builder.py        # ML feature engineering
│
├── ingestion/
│   ├── arcgis_client.py          # ArcGIS REST base client
│   ├── fetch_psa_outlooks.py     # 7-Day + Monthly outlooks
│   ├── fetch_active_incidents.py # NIFC IMSR incidents
│   ├── fetch_perimeters.py       # Near-RT perimeters
│   ├── fetch_raws_stations.py    # RAWS weather/fuels
│   └── scheduler.py              # APScheduler jobs
│
├── models/
│   ├── artifacts/                # Trained .pkl + meta.json
│   ├── train_psa_risk.py         # Model A: PSA activity risk
│   └── train_ignition_spike.py   # Model B: 24-72h ignition spike
│
└── scripts/
    └── run_ingestion.py          # Master ingestion CLI
```
