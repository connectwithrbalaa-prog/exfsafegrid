# ExfSafeGrid → Enterprise Production: Full Migration Plan

> **Audit Date:** 2026-02-28
> **Codebase:** `/home/user/exfsafegrid`
> **Platform:** Wildfire Operations & PSPS Decision Support

---

## Current State Summary

| Dimension | Score | Verdict |
|---|---|---|
| Security | 1/5 | Single API key, open CORS, no rate limiting |
| Reliability | 2/5 | No alerting, no circuit breakers, no rollback |
| Testability | 1/5 | Zero automated tests |
| Observability | 2/5 | Basic logs only, no metrics, no tracing |
| Scalability | 2/5 | Single VPS, sequential jobs, no async queue |
| Data / ML Quality | 2/5 | Synthetic training data, AUC ~0.58 (baseline) |

**Verdict:** MVP-ready for internal use. **Not production-ready** for customer-facing critical infrastructure.

---

## What "Enterprise Grade" Means for This Platform

For a wildfire ops + PSPS platform serving utilities, enterprise grade means:

- **Zero-downtime deploys** — circuit operators cannot lose visibility during a de-energization event
- **Audit trails** — every PSPS decision must be logged for CPUC/FERC compliance
- **Multi-tenant isolation** — PG&E data never touches SCE data
- **99.9%+ uptime SLA** — fire season has no maintenance windows
- **Real-time data** — 30-minute polling is too slow during Red Flag conditions
- **SOC 2 Type II / NERC CIP** — required for utility customers
- **Role-based access** — field crews, analysts, executives, and customers each see different data

---

## Phase 0 — Foundation Hardening (Weeks 1–3)

*Fix critical blockers. No new features.*

### 0A. Security Fixes

```python
# CORS: restrict to frontend domain only
allow_origins=["https://exafluence-solutions.cloud"]   # remove wildcard

# Rate limiting: SlowAPI
100 req/min per API key
10  req/min for /briefing/generate

# API keys: replace single key with per-tenant table in PostgreSQL
# Input validation: Pydantic bounds on all query params
limit:  1–500
offset: 0–10000
```

### 0B. Observability — Day 1

```
Structured logging:  python-json-logger
                     Every log line includes: timestamp, level, service,
                     request_id, user_id, circuit_id, duration_ms, error_code

Correlation IDs:     UUID injected at nginx → passed through FastAPI middleware → all logs

Error codes:         Replace {"error": "string"}
                     With    {"code": "ERR_MODEL_NOT_TRAINED", "message": "..."}

Health endpoint:     Expand /health → checks DB connection, scheduler alive,
                     last ingestion timestamp
```

### 0C. Database Indexes (run immediately)

```sql
CREATE INDEX CONCURRENTLY idx_mp_circuit_date_model
    ON model_predictions (circuit_id, prediction_date DESC, model_name);

CREATE INDEX CONCURRENTLY idx_incidents_state_active
    ON incidents (state, is_active, discovery_date DESC);

CREATE INDEX CONCURRENTLY idx_cf_date_circuit
    ON circuit_features (feature_date DESC, circuit_id);
```

### 0D. External API Resilience

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
def fetch_with_retry(url, params, timeout=30):
    return requests.get(url, params=params, timeout=timeout)
```

---

## Phase 1 — CI/CD & Environments (Weeks 3–6)

*Build the deploy machinery before building more features.*

### Environment Strategy

```
main branch     →  prod.exafluence-solutions.cloud    (auto-deploy after tests pass)
staging branch  →  staging.exafluence-solutions.cloud (auto-deploy on PR merge)
feature/*       →  ephemeral preview (up on PR open, down on PR close)
```

### GitHub Actions Pipeline (replaces current deploy.yml)

```
Trigger: push to staging or main

Steps:
  1. lint        →  ruff (Python) + eslint (TypeScript)
  2. test        →  pytest (backend) + vitest (frontend)
  3. coverage    →  fail if < 70%
  4. build       →  docker build + tag with git SHA
  5. push        →  GitHub Container Registry (ghcr.io)
  6. migrate     →  alembic upgrade head (against staging DB)
  7. deploy      →  blue-green swap (new container up → health check → old down)
  8. smoke test  →  curl /health, /psa-risk, /incidents/active
  9. notify      →  Slack on success/failure

Main branch: manual approval gate between steps 6 and 7
```

### Database Migrations — Alembic

```
Replace: docs/schema.sql as source of truth
Add:     alembic/ directory with versioned migration files

alembic upgrade head    →  runs on every deploy
alembic downgrade -1    →  rollback script

CI:  Test migrations against a throwaway Postgres container
```

### Blue-Green Deployment

```
Current:
  docker compose up -d --build   ← tears down old containers immediately

Replace:
  1. docker pull ghcr.io/your-org/exf-api:SHA
  2. Start exf_api_green on port 8001
  3. Health check passes → nginx upstream flips to 8001
  4. exf_api_blue (port 8000) stops after 30s drain

Result: zero downtime, instant rollback = flip nginx back
```

---

## Phase 2 — Testing Strategy (Weeks 4–8)

*Must happen in parallel with Phase 1.*

### Backend Tests (pytest)

```
tests/
  unit/
    test_feature_builder.py     — feature computation correctness
    test_agents.py              — mock Anthropic client, verify prompt structure
    test_ingestion_parsers.py   — parse real NIFC JSON fixtures
  integration/
    test_api_endpoints.py       — TestClient against test DB
    test_scheduler.py           — job execution without external calls
  fixtures/
    sample_incidents.json       — real NIFC response snapshots
    sample_outlooks.json
    conftest.py                 — test DB setup/teardown

Coverage target: 75% minimum, enforced in CI
```

### Frontend Tests (vitest + Testing Library)

```
src/test/
  components/
    WildfireMap.test.tsx        — renders without crashing, markers appear
    PspsStatusHeader.test.tsx   — shows correct status from mock API
    ProtectedRoute.test.tsx     — redirects unauthenticated users
  hooks/
    use-auth.test.tsx           — fix setTimeout race condition, test auth flow
  lib/
    wildfire-utils.test.ts      — pure function unit tests
    validation.test.ts          — input validation edge cases

E2E: Playwright — login → view map → request briefing → verify response
```

### ML Model Tests

```
tests/ml/
  test_feature_schema.py     — feature columns match model expected input
  test_model_loading.py      — pkl files load without error, accept known input
  test_prediction_range.py   — scores always 0.0–1.0
  test_risk_buckets.py       — LOW/MEDIUM/HIGH/CRITICAL thresholds consistent
```

---

## Phase 3 — Observability Stack (Weeks 6–10)

### Logging

```
Backend:
  python-json-logger → structured JSON
  Every log line includes: timestamp, level, service, request_id,
  user_id, circuit_id, duration_ms, error_code

Aggregation options:
  Option A (self-hosted):  Loki + Grafana (runs on VPS, $0 extra)
  Option B (managed):      Datadog / Papertrail (~$50/mo)
  Option C (AWS):          CloudWatch Logs (pay-per-GB)

Frontend:
  Sentry.io for JS error tracking + session replay
  Log API call failures with circuit/user context
```

### Metrics (Prometheus + Grafana)

```
Add to docker-compose.yml:
  prometheus:  scrapes /metrics from FastAPI (prometheus-fastapi-instrumentator)
  grafana:     dashboards for:
    - API request rate, latency (p50/p95/p99), error rate
    - Ingestion job success/failure per source
    - Model prediction throughput
    - DB connection pool usage
    - Circuit count by risk bucket (live dashboard)

Alerts (PagerDuty / Slack):
  - API error rate > 5% for 5 min
  - Ingestion job failed 3 consecutive times
  - DB connections > 80% pool capacity
  - No new incidents ingested in > 2 hours during fire season
```

### Distributed Tracing

```
OpenTelemetry SDK → Jaeger (self-hosted) or Honeycomb (managed)

Trace: nginx → FastAPI → DB query → Anthropic API call → response
Every span tagged with: circuit_id, psa_id, model_name, user_role
```

---

## Phase 4 — Authentication & Multi-Tenancy (Weeks 8–14)

### RBAC Model

```
Current: role = "agent" | "customer"   (2 roles, Supabase only)

Enterprise RBAC:
  Organization
    └── Users
          ├── sys_admin      →  everything
          ├── ops_analyst    →  all read + briefing generate
          ├── field_crew     →  field app only, own circuits
          ├── customer       →  own account data only
          └── api_client     →  programmatic access, scoped by org

Implementation:
  Supabase:  custom JWT claims { org_id, role, circuit_ids[] }
  FastAPI:   decode JWT, extract org_id → all queries WHERE org_id = :org_id
  DB:        Add org_id column to utility_circuits, model_predictions, psps_events
```

### API Key Strategy (Multi-Tenant)

```sql
CREATE TABLE api_keys (
    key_hash     TEXT PRIMARY KEY,      -- SHA-256, never store plain key
    org_id       UUID NOT NULL,
    key_name     TEXT,                  -- "prod-key-1", "ci-test"
    scopes       TEXT[],                -- ["read:predictions", "write:psps"]
    rate_limit   INTEGER DEFAULT 1000,  -- req/hour
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);
```

### Fix the Auth Race Condition

```typescript
// Current (broken): setTimeout hack to avoid deadlock
setTimeout(() => { if (isMounted) fetchRole(newSession.user.id); }, 0);

// Fix: proper async handling
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      setSession(session);
      if (session?.user) {
        const role = await fetchRole(session.user.id);  // await properly
        setUserRole(role);
      }
    }
  );
  return () => subscription.unsubscribe();
}, []);
```

---

## Phase 5 — Real Data & ML Pipeline (Weeks 10–20)

### Current ML Problem (Critical)

```
PSA Risk Model AUC:        0.58  (random = 0.50, production target = 0.80+)
Ignition Spike Model AUC:  0.50  (literally random)
Training data:             100% synthetic

These models cannot be used for production decisions.
```

### Real Data Sources

```
NIFC WFIGS API          →  historical incidents 2000–present (already fetching live)
NOAA RAWS historical    →  weather observations per station
CAL FIRE incident data  →  California historical ignitions
USFS Timber Sale data   →  vegetation/fuel load proxy
Homeland Infrastructure →  utility circuit shapefiles

Pipeline:
  Raw data → ingestion → circuit_features table → model training
           → evaluation → model registry → production

Target training set: 5+ years of real incidents, 10K+ circuit-days
Target AUC: ≥ 0.75 PSA risk, ≥ 0.72 ignition spike
```

### ML Model Registry (MLflow)

```yaml
# docker-compose.yml addition
mlflow:
  image: ghcr.io/mlflow/mlflow
  ports: ["5000:5000"]
  volumes: ["./mlruns:/mlruns"]
```

```
Model lifecycle:
  train    →  log to MLflow (params, metrics, artifacts)
  evaluate →  compare AUC vs current prod model
  promote  →  "staging" → human review → "production"
  serve    →  FastAPI loads from MLflow registry (not .pkl file)
  monitor  →  weekly AUC check against recent labeled data
```

### Feature Store

```
Short term:  Redis cache for circuit features (TTL = 1 hour)
  - Feature builder runs → writes to Redis
  - API reads from Redis
  - Eliminates repeated DB queries for same circuit_id + date

Long term:   Feast (open-source feature store)
  - Online store:  Redis (low-latency serving)
  - Offline store: PostgreSQL (training)
  - Pipelines:     replace APScheduler with Airflow DAGs
```

---

## Phase 6 — Scalability & Infrastructure (Weeks 16–24)

### Current Bottlenecks

```
Single VPS:            one machine = single point of failure
Sequential ingestion:  APScheduler runs jobs one at a time
Synchronous agents:    POST /briefing/generate blocks for 10–30s
No caching:            same DB query repeated on every API call
```

### Async Task Queue (Celery + Redis)

```
Replace: APScheduler (single-threaded, in-process)
With:    Celery workers (multi-process, distributed)

docker-compose.yml additions:
  redis:   message broker
  worker:  celery -A tasks worker --concurrency=4
  beat:    celery -A tasks beat  (replaces scheduler)
  flower:  celery monitoring UI

Benefits:
  - Ingestion jobs run in parallel (incidents + perimeters simultaneously)
  - POST /briefing/generate returns task_id immediately; client polls /tasks/{id}
  - Failed jobs retry automatically with exponential backoff
  - Dead-letter queue for permanently failed jobs (alert fires)
```

### Horizontal Scaling Path

```
Stage 1 (now):       1x VPS, Docker Compose
Stage 2 (6 months):  2x VPS, nginx load balancer, shared PostgreSQL, shared Redis
Stage 3 (1 year):    Kubernetes (k3s or EKS/GKE)
                       - API:     2–4 pods, HPA on CPU
                       - Workers: 2–8 pods, HPA on queue depth
                       - DB:      RDS PostgreSQL Multi-AZ (managed, auto-backup)
                       - Cache:   ElastiCache Redis
Stage 4 (2+ years):  Multi-region active-active for multi-GACC utility customers
```

### CDN + Static Assets

```
Current: nginx on VPS serves React bundle

Add: Cloudflare (free tier) in front of VPS
  - React bundle cached at edge worldwide
  - DDoS protection
  - SSL termination (offloads from VPS)
  - Bot management
```

### Database Scaling

```
Add now:
  PgBouncer           — connection pooler between FastAPI and PostgreSQL
  Read replica        — for reporting queries (briefing generation, trend analysis)

Add later:
  TimescaleDB         — for time-series data (RAWS observations, predictions)
                        compresses historical data 90%+
                        continuous aggregates replace slow GROUP BY queries
  Partitioning        — incidents, raws_observations by month
```

---

## Phase 7 — Compliance & Audit (Weeks 20–30)

### Audit Logging (Compliance Requirement for Utilities)

```sql
CREATE TABLE audit_log (
    id           BIGSERIAL PRIMARY KEY,
    event_time   TIMESTAMPTZ DEFAULT NOW(),
    org_id       UUID,
    user_id      UUID,
    action       TEXT,      -- "PSPS_SIMULATE", "BRIEFING_GENERATED", "CIRCUIT_VIEWED"
    resource_id  TEXT,      -- circuit_id, psa_id, etc.
    ip_address   INET,
    request_id   UUID,
    payload_hash TEXT,      -- SHA-256 of request body (not stored plaintext)
    outcome      TEXT       -- "SUCCESS" | "DENIED" | "ERROR"
);
-- Retention: 7 years (FERC requirement)
-- Immutable:  no UPDATE/DELETE permissions granted on this table
```

### Data Privacy

```
PII scope:      customer addresses, medical baseline status, account numbers
Encryption:     AES-256 at rest for customer table columns
Masking:        API responses mask PII unless role = "customer" (own data) or "sys_admin"
Right to delete: Soft-delete with 90-day purge job
Data residency:  VPS in correct jurisdiction (CA utilities = US West)
```

### Compliance Targets

```
SOC 2 Type II:  6–12 months to achieve
                (audit logging, access controls, pen test required)
NERC CIP:       If managing bulk electric system assets (consult legal)
CPUC Rule 14:   California PSPS notification requirements — logging + reporting built in
ISO 27001:      Optional, 12–18 months
```

---

## Codebase Assessment: What to Keep vs. Replace

### Keep As-Is (Good Foundations)

| Component | Why It's Solid |
|---|---|
| FastAPI structure | Clean separation: `api/`, `agents/`, `ingestion/`, `config/` |
| PostGIS schema | Geospatial design correct — polygons, GiST indexes, SRID 4326 |
| Docker Compose | Good starting point; evolves to k8s naturally |
| Supabase Auth | JWT + RLS is the right pattern; add custom claims |
| React + Vite + shadcn/ui | Modern, maintainable stack |
| Scheduler pattern | APScheduler → Celery is a straight swap |
| Agent prompts | Prompt engineering is solid; wrap in retry/error handling |

### Replace Before Scaling

| Component | Replace With | Reason |
|---|---|---|
| `.pkl` model files | MLflow model registry | No versioning, no rollback |
| `APScheduler` | Celery + Redis | No distribution, no retry |
| Single API key | Per-tenant key table | No isolation, no rotation |
| `docs/schema.sql` | Alembic migrations | Schema drift in prod |
| `logging.basicConfig` | `python-json-logger` + Loki | No correlation, no search |
| Synthetic ML data | Real NIFC/RAWS historical data | AUC 0.5 = coin flip |
| Direct `requests.get` | Tenacity retry wrapper | No resilience |

### Add New (Missing Entirely)

```
Redis           —  caching, task queue broker
Celery          —  async task processing
PgBouncer       —  DB connection pooling
Prometheus      —  metrics collection
Grafana         —  dashboards + alerting
Sentry          —  frontend error tracking + session replay
Alembic         —  database migrations
MLflow          —  model registry + experiment tracking
Playwright      —  E2E tests
pytest          —  backend unit/integration tests
```

---

## Priority Fix List

### Critical (Week 1)

1. Add API rate limiting — prevent abuse
2. Implement request logging with correlation IDs — for debugging production incidents
3. Add structured error codes — replace generic `"error"` strings
4. Fix CORS — restrict to frontend domain only
5. Add database indexes — `circuit_id`, `prediction_date`, `psa_id`

### High (Weeks 2–3)

6. Add API key rotation strategy
7. Implement circuit breaker for external API calls
8. Add model performance monitoring
9. Set up centralized logging (Loki or Datadog)
10. Add staging environment + promotion gates

### Medium (Month 1)

11. Implement database migrations (Alembic)
12. Add comprehensive unit + integration tests
13. Retrain models on real incident data (replace synthetic)
14. Add data quality checks (Great Expectations)
15. Implement feature store

### Longer Term

16. Multi-region deployment for disaster recovery
17. Real-time data pipelines (Kafka/Kinesis instead of polling)
18. Advanced RBAC (attribute-based access control)
19. ML observability (Arize, Evidently, or similar)
20. Compliance framework (SOC 2, ISO 27001)

---

## Team & Timeline Summary

| Phase | Duration | Team | Outcome |
|---|---|---|---|
| 0: Hardening | Weeks 1–3 | 1 backend dev | Secure, observable, no crashes |
| 1: CI/CD | Weeks 3–6 | 1 devops | Blue-green deploy, staging env |
| 2: Testing | Weeks 4–8 | 1 backend + 1 frontend | 75% coverage, no regressions |
| 3: Observability | Weeks 6–10 | 1 devops | Dashboards, alerts, traces |
| 4: Auth/Multi-tenant | Weeks 8–14 | 1 backend | RBAC, org isolation |
| 5: Real ML | Weeks 10–20 | 1 ML engineer | AUC ≥ 0.75, real data |
| 6: Scale | Weeks 16–24 | 1 devops + 1 backend | Celery, Redis, k8s-ready |
| 7: Compliance | Weeks 20–30 | 1 backend + legal | SOC 2 path, audit logs |

**Total: ~6–8 months with 2–3 engineers to full enterprise production.**

The current codebase provides roughly **40% of the foundation** built correctly. The domain model (circuits, PSAs, PSPS, RAWS, outlooks) is sound — that is the hardest part. What is missing is the operational envelope around it.
