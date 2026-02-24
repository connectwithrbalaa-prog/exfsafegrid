# ExfSafeGrid Phase 2 Roadmap

## Phase 1 Recap (Delivered)

| Capability | Status |
|---|---|
| NIFC 7-Day Outlook ingestion (Day 1–7) | ✅ |
| NIFC Monthly/Extended Outlook (Month 1–4) | ✅ |
| WFIGS Active Incident ingestion | ✅ |
| Wildfire Perimeter near-real-time ingestion | ✅ |
| Key RAWS weather/fuels ingestion | ✅ |
| Master scheduler (15min / 3h / daily) | ✅ |
| Model A: PSA risk (1–3 month) | ✅ |
| Model B: Circuit ignition spike (24/48/72h) | ✅ |
| FastAPI + Docker | ✅ |
| Ops Briefing Agent (Claude) | ✅ |
| PSPS Planning Agent v0 (Claude) | ✅ |

---

## Phase 2: Enhanced Signals & Accuracy

### 2.1 NWS Red Flag Warning Integration

**Priority**: HIGH
**Timeline**: Week 1–2

- Ingest NWS CAP/ATOM alert feed for Red Flag Warnings
- Map warnings to circuits via PSA/county geometry
- Add `is_red_flag` as a real-time Model B feature (currently synthetic)
- Endpoint: `GET /alerts/red-flag`

### 2.2 Real Ignition / Fault History

**Priority**: HIGH
**Timeline**: Week 2–3

- Load utility-provided fault/ignition history into `faults_ignitions`
- Re-train Model B with real labels (replace synthetic bootstrap)
- Expected AUC improvement: 0.72 → 0.82+
- Add SCADA integration hook for real-time fault reporting

### 2.3 Spot Weather Forecast Integration

**Priority**: HIGH
**Timeline**: Week 2–4

- Ingest NWS spot forecasts for each circuit's centroid
- Features: forecast wind speed/gust, temp, RH at 6h/12h/24h intervals
- Replace RAWS-extrapolated weather with actual NWS gridded forecasts (NDFD)
- Source: `https://api.weather.gov/gridpoints/{office}/{x},{y}/forecast/hourly`

### 2.4 VIIRS Active Fire Detection

**Priority**: MEDIUM
**Timeline**: Week 3–4

- Ingest NASA FIRMS VIIRS near-real-time fire detection (3–4h latency)
- Compute "active fire pixels within N miles of circuit" feature
- Much finer spatial resolution than IMSR incidents (~375m pixels)
- Source: `https://firms.modaps.eosdis.nasa.gov/api/`

---

## Phase 3: Operational Intelligence

### 3.1 PSPS Impact Modeling

**Priority**: HIGH
**Timeline**: Month 2

- Customer segmentation: medical baseline, ADA, CARE/FERA, AFN
- Critical facilities database (hospitals, fire stations, water treatment)
- Multi-circuit de-energization scenario analysis
- `GET /psps-impact-analysis?circuits=[...]` → customer impact + alternatives

### 3.2 Wind Forecast Integration

**Priority**: HIGH
**Timeline**: Month 2

- NOAA HRRR (High-Resolution Rapid Refresh) 18h wind forecasts
- Per-circuit wind exposure from circuit geometry + terrain
- Replace static wind features with forecast time series
- Calibrated gust exceedance probabilities (P80, P95)

### 3.3 Fuel Moisture Data

**Priority**: MEDIUM
**Timeline**: Month 2–3

- USFS Fuel Moisture Database API
- 1-hour, 10-hour, 100-hour dead fuel moisture
- Live fuel moisture (chaparral, grass)
- Strong predictor for ERC/BI calibration

### 3.4 Automated PSPS Decision Support

**Priority**: HIGH (PSPS Planning Agent v1)
**Timeline**: Month 2–3

Upgrade PSPS Planning Agent from v0 to v1:

- Multi-circuit optimization (minimize customers-off while meeting risk threshold)
- Temporal optimization (pre-event staging window)
- Automated patrol/inspection schedule generation
- PSPS notification draft generation (customer letters, media releases)

---

## Phase 4: Advanced ML

### 4.1 Spatial Graph Neural Network

**Priority**: MEDIUM
**Timeline**: Month 3–4

- Model circuits as graph nodes with electrical topology
- Cascading fault probability modeling
- Better transfer learning for data-sparse circuits

### 4.2 Transformer-Based Sequence Model

**Priority**: MEDIUM
**Timeline**: Month 4–5

- Time-series model for 72h weather + fuel trajectory
- Replaces static daily features with rolling 7-day sequences
- Expected uplift: +5–8% AUC on ignition spike model

### 4.3 Ensemble & Calibration

**Timeline**: Month 3

- Ensemble Model A + Model B with Model C (NWS-based rule engine)
- Platt scaling for calibrated probability outputs
- Threshold optimization per HFTD tier

### 4.4 Online Learning

**Timeline**: Month 5–6

- Stream new ignition events → incremental model updates
- Drift detection on feature distributions (wind regime shifts)
- A/B testing framework for model version comparison

---

## Phase 5: Platform Expansion

### 5.1 Multi-Utility Support

- Multi-tenant architecture (utility_id on all tables)
- Per-utility model instances with federated training
- Utility-specific threshold profiles

### 5.2 PSPS Post-Event Analysis

- Automated post-event report generation
- Counterfactual analysis (would fire have started without PSPS?)
- Regulator reporting templates (CPUC, FERC)

### 5.3 Customer-Facing PSPS Portal

- ExfSafeGrid Customer View enhancements
- Proactive outreach list generation (medical/critical customers first)
- Restoration ETA predictions

### 5.4 Mobile App (Field Crews)

- React Native app for field crew situational awareness
- Offline-capable map with circuit risk overlays
- Patrol completion tracking

---

## Recommended Phase 2 Sprint Plan

| Week | Focus |
|---|---|
| 1 | Red Flag Warning ingestion + real fault data import |
| 2 | NWS spot forecast integration + Model B retrain with real labels |
| 3 | VIIRS fire detection + PSPS impact modeling v1 |
| 4 | HRRR wind forecasts + PSPS Agent v1 upgrade |
| 5 | Calibration, evaluation, load testing |
| 6 | Customer View enhancements + ExfSafeGrid v2 release |

---

## Technical Debt to Address in Phase 2

1. **Async task queue**: Replace synchronous model training/scoring with Celery + Redis
2. **Model versioning**: MLflow or DVC for experiment tracking
3. **Circuit geometry**: Automated spatial join of circuits to PSA polygons (currently manual PSA assignment)
4. **Secrets management**: Move API keys to Vault or AWS Secrets Manager
5. **Test coverage**: Add pytest suite for ingestion parsers and API endpoints
6. **Alembic migrations**: Replace manual schema.sql with Alembic for schema evolution
