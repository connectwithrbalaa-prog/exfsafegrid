-- ============================================================
-- ExfSafeGrid Wildfire Ops & PSPS Backend — Database Schema v2
-- ============================================================
-- Run: psql -U postgres -d exf_wildfire -f docs/schema.sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- ────────────────────────────────────────────────────────────────
-- 1. PSA Reference
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psa_reference (
    psa_id      TEXT PRIMARY KEY,
    psa_name    TEXT,
    gacc_id     TEXT,
    state       TEXT,
    geometry    GEOMETRY(MULTIPOLYGON, 4326),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psa_geom ON psa_reference USING GIST (geometry);
-- ────────────────────────────────────────────────────────────────
-- 2. PSA Outlooks (7-day + monthly unified)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psa_outlook (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    psa_id               TEXT NOT NULL,
    outlook_type         TEXT NOT NULL CHECK (outlook_type IN ('7day', 'monthly')),
    forecast_date        DATE NOT NULL,
    period_label         TEXT NOT NULL,        -- 'Day1'...'Day7' or 'Month1'...'Month4'
    fire_potential       SMALLINT,
    fire_potential_label TEXT,
    raw_json             JSONB,
    geometry             GEOMETRY(MULTIPOLYGON, 4326),
    retrieved_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (psa_id, outlook_type, forecast_date, period_label)
);
CREATE INDEX IF NOT EXISTS idx_psa_outlook_psa_date ON psa_outlook (psa_id, forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_psa_outlook_type_label ON psa_outlook (outlook_type, period_label, forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_psa_outlook_geom ON psa_outlook USING GIST (geometry);
-- ────────────────────────────────────────────────────────────────
-- 3. Active Wildfire Incidents
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id     TEXT UNIQUE NOT NULL,
    incident_name   TEXT,
    state           TEXT,
    psa_id          TEXT,
    cause           TEXT,
    discovery_date  TIMESTAMPTZ,
    last_update     TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    acres_burned    NUMERIC(14,2),
    containment_pct SMALLINT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    geometry        GEOMETRY(POINT, 4326),
    raw_json        JSONB,
    retrieved_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incidents_active ON incidents (is_active, state);
CREATE INDEX IF NOT EXISTS idx_incidents_geom ON incidents USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_incidents_discovery ON incidents (discovery_date DESC);
-- ────────────────────────────────────────────────────────────────
-- 4. Wildfire Perimeters
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perimeters (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perimeter_id    TEXT,
    incident_id     TEXT NOT NULL,
    incident_name   TEXT,
    state           TEXT,
    gis_acres       NUMERIC(14,2),
    map_acres       NUMERIC(14,2),
    containment_pct SMALLINT,
    date_current    TIMESTAMPTZ NOT NULL,
    geometry        GEOMETRY(MULTIPOLYGON, 4326),
    raw_json        JSONB,
    retrieved_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (incident_id, date_current)
);
CREATE INDEX IF NOT EXISTS idx_perimeters_incident ON perimeters (incident_id, date_current DESC);
CREATE INDEX IF NOT EXISTS idx_perimeters_geom ON perimeters USING GIST (geometry);
-- ────────────────────────────────────────────────────────────────
-- 5. RAWS Observations
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raws_observations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id      TEXT NOT NULL,
    station_name    TEXT,
    psa_id          TEXT,
    obs_time        TIMESTAMPTZ NOT NULL,
    temp_f          NUMERIC(6,2),
    rh_pct          NUMERIC(5,2),
    wind_speed_mph  NUMERIC(6,2),
    wind_gust_mph   NUMERIC(6,2),
    wind_dir_deg    SMALLINT,
    precip_in       NUMERIC(6,3),
    erc             NUMERIC(6,2),
    bi              NUMERIC(6,2),
    ffwi            NUMERIC(6,2),
    geometry        GEOMETRY(POINT, 4326),
    raw_json        JSONB,
    retrieved_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (station_id, obs_time)
);
CREATE INDEX IF NOT EXISTS idx_raws_station_time ON raws_observations (station_id, obs_time DESC);
CREATE INDEX IF NOT EXISTS idx_raws_psa_time ON raws_observations (psa_id, obs_time DESC);
-- ────────────────────────────────────────────────────────────────
-- 6. Utility Circuits
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utility_circuits (
    circuit_id        TEXT PRIMARY KEY,
    circuit_name      TEXT,
    voltage_kv        NUMERIC(6,1),
    utility_name      TEXT,
    psa_id            TEXT,
    county            TEXT,
    state             TEXT,
    hftd_tier         SMALLINT,
    length_miles      NUMERIC(8,2),
    customer_count    INTEGER,
    critical_customers INTEGER DEFAULT 0,
    geometry          GEOMETRY(MULTILINESTRING, 4326),
    metadata          JSONB,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_circuits_psa ON utility_circuits (psa_id);
CREATE INDEX IF NOT EXISTS idx_circuits_hftd ON utility_circuits (hftd_tier);
CREATE INDEX IF NOT EXISTS idx_circuits_geom ON utility_circuits USING GIST (geometry);
-- ────────────────────────────────────────────────────────────────
-- 7. PSPS Events
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psps_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        TEXT UNIQUE,
    circuit_id      TEXT REFERENCES utility_circuits(circuit_id),
    utility_name    TEXT,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT FALSE,
    customers_off   INTEGER,
    peak_wind_mph   NUMERIC(6,2),
    trigger_reason  TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psps_circuit ON psps_events (circuit_id, start_time DESC);
-- ────────────────────────────────────────────────────────────────
-- 8. Faults & Ignitions (training labels for Model B)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faults_ignitions (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circuit_id         TEXT REFERENCES utility_circuits(circuit_id),
    event_date         DATE NOT NULL,
    event_type         TEXT NOT NULL CHECK (event_type IN ('fault','ignition','near_miss')),
    confirmed_ignition BOOLEAN DEFAULT FALSE,
    cause              TEXT,
    wind_mph           NUMERIC(6,2),
    temp_f             NUMERIC(6,2),
    rh_pct             NUMERIC(5,2),
    notes              TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fi_circuit_date ON faults_ignitions (circuit_id, event_date DESC);
-- ────────────────────────────────────────────────────────────────
-- 9. ML Feature Store
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circuit_features (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circuit_id       TEXT NOT NULL REFERENCES utility_circuits(circuit_id),
    feature_date     DATE NOT NULL,
    fp_7day_d1       SMALLINT,
    fp_7day_d2       SMALLINT,
    fp_7day_d3       SMALLINT,
    fp_7day_d4       SMALLINT,
    fp_7day_d5       SMALLINT,
    fp_7day_d6       SMALLINT,
    fp_7day_d7       SMALLINT,
    fp_monthly_m1    SMALLINT,
    fp_monthly_m2    SMALLINT,
    fp_monthly_m3    SMALLINT,
    max_temp_f       NUMERIC(6,2),
    min_rh_pct       NUMERIC(5,2),
    max_wind_mph     NUMERIC(6,2),
    max_gust_mph     NUMERIC(6,2),
    erc_max          NUMERIC(6,2),
    bi_max           NUMERIC(6,2),
    ffwi_max         NUMERIC(6,2),
    active_incidents_50mi  INTEGER DEFAULT 0,
    acres_burning_50mi     NUMERIC(14,2) DEFAULT 0,
    psps_events_90d  INTEGER DEFAULT 0,
    ignitions_365d   INTEGER DEFAULT 0,
    faults_90d       INTEGER DEFAULT 0,
    hftd_tier        SMALLINT,
    length_miles     NUMERIC(8,2),
    voltage_kv       NUMERIC(6,1),
    day_of_year      SMALLINT,
    month_of_year    SMALLINT,
    is_red_flag      BOOLEAN DEFAULT FALSE,
    label_above_normal_activity BOOLEAN,
    label_ignition_spike        BOOLEAN,
    label_psps                  BOOLEAN,
    computed_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (circuit_id, feature_date)
);
CREATE INDEX IF NOT EXISTS idx_cf_circuit_date ON circuit_features (circuit_id, feature_date DESC);
CREATE INDEX IF NOT EXISTS idx_cf_date ON circuit_features (feature_date DESC);
-- ────────────────────────────────────────────────────────────────
-- 10. Model Predictions
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_predictions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name      TEXT NOT NULL,
    model_version   TEXT,
    circuit_id      TEXT,
    psa_id          TEXT,
    prediction_date DATE NOT NULL,
    horizon_label   TEXT,
    prob_score      NUMERIC(6,4),
    risk_bucket     TEXT,
    top_drivers     JSONB,
    predicted_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mp_model_date ON model_predictions (model_name, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_mp_circuit ON model_predictions (circuit_id, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_mp_psa ON model_predictions (psa_id, prediction_date DESC);
-- ────────────────────────────────────────────────────────────────
-- 11. Daily Briefings
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_briefings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    briefing_date   DATE NOT NULL UNIQUE,
    markdown_text   TEXT NOT NULL,
    structured_data JSONB,
    model_used      TEXT,
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- ────────────────────────────────────────────────────────────────
-- 12. PSPS Watchlists
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psps_watchlists (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watchlist_date  DATE NOT NULL,
    horizon         TEXT NOT NULL DEFAULT '24h',
    markdown_text   TEXT,
    structured_data JSONB,
    model_used      TEXT,
    tokens_used     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (watchlist_date, horizon)
);
-- ────────────────────────────────────────────────────────────────
-- 13. Ingestion Audit Log
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingestion_log (
    id               BIGSERIAL PRIMARY KEY,
    source           TEXT NOT NULL,
    run_time         TIMESTAMPTZ DEFAULT NOW(),
    records_fetched  INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated  INTEGER DEFAULT 0,
    status           TEXT DEFAULT 'success',
    error_msg        TEXT,
    duration_sec     NUMERIC(8,2)
);
CREATE INDEX IF NOT EXISTS idx_ilog_source_time ON ingestion_log (source, run_time DESC);
