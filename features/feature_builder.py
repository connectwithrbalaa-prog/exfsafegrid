"""
features/feature_builder.py
============================
Build per-circuit feature rows for a given prediction date.
Used by Model A (psa_risk), Model B (ignition_spike), and Model C (fire_spread).

Priority:
  1. Load from pre-computed `circuit_features` table.
  2. Build features from real data: RAWS weather, incident/perimeter proximity,
     PSA outlooks, customer density, fault history.
  3. Fall back to synthetic features only when real data sources are empty.
"""
import json
import logging
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import text

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def build_features_for_date(prediction_date: date, db) -> pd.DataFrame:
    """
    Return a DataFrame with one row per circuit containing all features
    needed by Models A, B, and C.
    """
    # 1. Try pre-computed feature store
    df = _load_precomputed(prediction_date, db)

    # 2. Build from real data sources
    if df.empty:
        logger.info("No pre-computed features for %s — building from real data.", prediction_date)
        df = _build_from_real_data(prediction_date, db)

    # 3. Fall back to synthetic
    if df.empty:
        logger.info("No real data available — generating synthetic features.")
        df = _generate_synthetic(prediction_date, db)

    if df.empty:
        logger.warning("No circuits found — cannot build features.")
        return df

    # Add derived temporal columns
    df["feature_date"] = pd.to_datetime(prediction_date)
    month = prediction_date.month
    day_of_year = prediction_date.timetuple().tm_yday
    df["month_of_year"] = month
    df["month_sin"] = np.sin(2 * np.pi * month / 12)
    df["month_cos"] = np.cos(2 * np.pi * month / 12)
    df["day_sin"] = np.sin(2 * np.pi * day_of_year / 365)
    df["day_cos"] = np.cos(2 * np.pi * day_of_year / 365)
    df["is_red_flag_int"] = df.get("is_red_flag", pd.Series(0, index=df.index)).astype(int)

    return df


# ---------------------------------------------------------------------------
# 1. Pre-computed feature store
# ---------------------------------------------------------------------------

def _load_precomputed(prediction_date: date, db) -> pd.DataFrame:
    """Load the latest feature row per circuit on or before prediction_date."""
    try:
        return pd.read_sql(
            text("""
                SELECT DISTINCT ON (cf.circuit_id)
                       cf.*, uc.psa_id, uc.voltage_kv, uc.utility_name,
                       uc.hftd_tier, uc.county, uc.customer_count,
                       uc.critical_customers, uc.length_miles
                FROM circuit_features cf
                JOIN utility_circuits uc ON uc.circuit_id = cf.circuit_id
                WHERE cf.feature_date <= :pred_date
                ORDER BY cf.circuit_id, cf.feature_date DESC
            """),
            db.bind,
            params={"pred_date": str(prediction_date)},
        )
    except Exception as e:
        logger.debug("Pre-computed feature load failed: %s", e)
        return pd.DataFrame()


# ---------------------------------------------------------------------------
# 2. Build from real ingested data
# ---------------------------------------------------------------------------

def _build_from_real_data(prediction_date: date, db) -> pd.DataFrame:
    """Join real RAWS, outlook, incident, perimeter, fault, and customer data."""
    circuits = _load_circuits(db)
    if circuits.empty:
        return pd.DataFrame()

    # Fetch each data source independently
    weather = _get_raws_weather(prediction_date, db)
    outlooks_7d = _get_7day_outlooks(prediction_date, db)
    outlooks_monthly = _get_monthly_outlooks(prediction_date, db)
    incident_result = _get_incident_proximity(prediction_date, db)
    perimeter_proximity = _get_perimeter_proximity(prediction_date, db)
    fault_history = _get_fault_history(prediction_date, db)
    customer_density = _get_customer_density(db)

    # Unpack incident result — may be tuple (circuit_df, psa_df) or single df
    incident_circuit = pd.DataFrame()
    incident_psa = pd.DataFrame()
    if isinstance(incident_result, tuple):
        incident_circuit, incident_psa = incident_result
    elif isinstance(incident_result, pd.DataFrame) and not incident_result.empty:
        if "circuit_id" in incident_result.columns:
            incident_circuit = incident_result
        else:
            incident_psa = incident_result

    # Check if we have ANY real data to work with
    has_real = any(not d.empty for d in [
        weather, outlooks_7d, outlooks_monthly,
        incident_circuit, incident_psa, perimeter_proximity,
    ])
    if not has_real:
        logger.info("No real RAWS/outlook/incident data found — skipping real build.")
        return pd.DataFrame()

    # Start with circuit base
    df = circuits[["circuit_id", "psa_id", "voltage_kv", "hftd_tier",
                    "length_miles", "utility_name"]].copy()

    # --- RAWS weather (joined by psa_id) ---
    if not weather.empty:
        df = df.merge(weather, on="psa_id", how="left")
    else:
        for col in ["max_temp_f", "min_rh_pct", "max_wind_mph", "max_gust_mph",
                     "erc_max", "bi_max", "ffwi_max"]:
            df[col] = np.nan

    # Derive red flag: wind > 25 AND rh < 15
    df["is_red_flag"] = (
        (df["max_wind_mph"].fillna(0) >= 25) &
        (df["min_rh_pct"].fillna(100) <= 15)
    ).astype(int)

    # --- 7-day outlooks (joined by psa_id) ---
    if not outlooks_7d.empty:
        df = df.merge(outlooks_7d, on="psa_id", how="left")
    else:
        for i in range(1, 8):
            df[f"fp_7day_d{i}"] = np.nan
    # Computed 7-day summary stats
    day_cols = [f"fp_7day_d{i}" for i in range(1, 8)]
    existing_day_cols = [c for c in day_cols if c in df.columns]
    if existing_day_cols:
        df["fp_7day_max"] = df[existing_day_cols].max(axis=1)
        df["fp_7day_mean"] = df[existing_day_cols].mean(axis=1).round(2)
        df["fp_7day_trend"] = (
            df[existing_day_cols[-1]] - df[existing_day_cols[0]]
        ).fillna(0) if len(existing_day_cols) > 1 else 0

    # --- Monthly outlooks (joined by psa_id) ---
    if not outlooks_monthly.empty:
        df = df.merge(outlooks_monthly, on="psa_id", how="left")
    else:
        for i in range(1, 4):
            df[f"fp_monthly_m{i}"] = np.nan

    # --- Incident proximity (circuit-level geospatial or PSA fallback) ---
    if not incident_circuit.empty:
        df = df.merge(incident_circuit, on="circuit_id", how="left")
    if not incident_psa.empty:
        df = df.merge(incident_psa, on="psa_id", how="left", suffixes=("", "_psa"))
    for col, default in [("active_incidents_50mi", 0), ("acres_burning_50mi", 0),
                          ("psa_acres_30d", 0), ("psa_acres_60d", 0), ("psa_acres_90d", 0),
                          ("psa_fires_30d", 0), ("psa_fires_60d", 0), ("psa_fires_90d", 0)]:
        if col not in df.columns:
            df[col] = default

    # --- Perimeter proximity (circuit-level geospatial or PSA fallback) ---
    if not perimeter_proximity.empty:
        join_col = "circuit_id" if "circuit_id" in perimeter_proximity.columns else "psa_id"
        df = df.merge(perimeter_proximity, on=join_col, how="left")

    # --- Fault / ignition history (joined by circuit_id) ---
    if not fault_history.empty:
        df = df.merge(fault_history, on="circuit_id", how="left")
    for col in ["faults_90d", "ignitions_365d"]:
        if col not in df.columns:
            df[col] = 0

    # --- Customer density (joined by circuit_id or psa_id) ---
    if not customer_density.empty:
        df = df.merge(customer_density, on="psa_id", how="left")
    for col in ["customer_count", "medical_baseline_pct", "hftd_customer_pct"]:
        if col not in df.columns:
            df[col] = 0

    # --- PSA risk score (derived) ---
    if "psa_risk_score" not in df.columns:
        # Composite risk: normalize 7-day max + wind + inverse RH
        fp_max = df.get("fp_7day_max", pd.Series(2.5, index=df.index)).fillna(2.5)
        wind = df["max_wind_mph"].fillna(15)
        rh = df["min_rh_pct"].fillna(30)
        df["psa_risk_score"] = (
            (fp_max / 5) * 0.4 +
            (wind.clip(0, 60) / 60) * 0.3 +
            ((100 - rh.clip(0, 100)) / 100) * 0.3
        ).round(4)

    # Fill remaining NaNs with 0
    df = df.fillna(0)

    logger.info("Built features from real data: %d circuits, columns: %s",
                len(df), list(df.columns))
    return df


# ---------------------------------------------------------------------------
# Data source queries
# ---------------------------------------------------------------------------

def _load_circuits(db) -> pd.DataFrame:
    try:
        return pd.read_sql(
            text("""SELECT circuit_id, psa_id, voltage_kv, hftd_tier,
                           length_miles, utility_name, county, customer_count,
                           critical_customers,
                           (geom_point IS NOT NULL) AS has_geom_point
                    FROM utility_circuits ORDER BY circuit_id"""),
            db.bind,
        )
    except Exception:
        return pd.DataFrame()


def _get_raws_weather(prediction_date: date, db) -> pd.DataFrame:
    """Aggregate recent RAWS observations per PSA: max temp, min RH, max wind, etc."""
    lookback = prediction_date - timedelta(days=2)
    try:
        df = pd.read_sql(
            text("""
                SELECT psa_id,
                       MAX(temp_f)          AS max_temp_f,
                       MIN(rh_pct)          AS min_rh_pct,
                       MAX(wind_speed_mph)  AS max_wind_mph,
                       MAX(wind_gust_mph)   AS max_gust_mph,
                       MAX(erc)             AS erc_max,
                       MAX(bi)              AS bi_max,
                       MAX(ffwi)            AS ffwi_max
                FROM raws_observations
                WHERE obs_time >= :lookback AND obs_time <= :pred_date
                  AND psa_id IS NOT NULL AND psa_id != ''
                GROUP BY psa_id
            """),
            db.bind,
            params={"lookback": str(lookback), "pred_date": str(prediction_date)},
        )
        logger.info("RAWS weather: %d PSAs with data", len(df))
        return df
    except Exception as e:
        logger.debug("RAWS weather query failed: %s", e)
        return pd.DataFrame()


def _get_7day_outlooks(prediction_date: date, db) -> pd.DataFrame:
    """Pivot 7-day outlook into columns fp_7day_d1..d7 per PSA."""
    try:
        df = pd.read_sql(
            text("""
                SELECT psa_id, period_label, fire_potential
                FROM psa_outlook
                WHERE outlook_type = '7day'
                  AND forecast_date = :pred_date
                ORDER BY psa_id, period_label
            """),
            db.bind,
            params={"pred_date": str(prediction_date)},
        )
        if df.empty:
            return df
        # Pivot Day1..Day7 → fp_7day_d1..d7
        pivot = df.pivot_table(index="psa_id", columns="period_label",
                               values="fire_potential", aggfunc="first")
        result = pd.DataFrame({"psa_id": pivot.index})
        for i in range(1, 8):
            col = f"Day{i}"
            result[f"fp_7day_d{i}"] = pivot[col].values if col in pivot.columns else np.nan
        logger.info("7-day outlooks: %d PSAs", len(result))
        return result.reset_index(drop=True)
    except Exception as e:
        logger.debug("7-day outlook query failed: %s", e)
        return pd.DataFrame()


def _get_monthly_outlooks(prediction_date: date, db) -> pd.DataFrame:
    """Get monthly outlook fire potential per PSA."""
    try:
        df = pd.read_sql(
            text("""
                SELECT psa_id, period_label, fire_potential
                FROM psa_outlook
                WHERE outlook_type = 'monthly'
                  AND forecast_date = :pred_date
                ORDER BY psa_id, period_label
            """),
            db.bind,
            params={"pred_date": str(prediction_date)},
        )
        if df.empty:
            return df
        pivot = df.pivot_table(index="psa_id", columns="period_label",
                               values="fire_potential", aggfunc="first")
        result = pd.DataFrame({"psa_id": pivot.index})
        for i in range(1, 4):
            col = f"Month{i}"
            result[f"fp_monthly_m{i}"] = pivot[col].values if col in pivot.columns else np.nan
        logger.info("Monthly outlooks: %d PSAs", len(result))
        return result.reset_index(drop=True)
    except Exception as e:
        logger.debug("Monthly outlook query failed: %s", e)
        return pd.DataFrame()


def _get_incident_proximity(prediction_date: date, db) -> pd.DataFrame:
    """
    Count active incidents within 50 miles of each circuit using geom_point
    (PostGIS ST_DWithin). Falls back to PSA-based grouping when geom_point
    is unavailable.
    """
    try:
        # Try geospatial approach first (geom_point on utility_circuits)
        df = pd.read_sql(
            text("""
                SELECT
                    uc.circuit_id,
                    COUNT(i.*)                           AS active_incidents_50mi,
                    COALESCE(SUM(i.acres_burned), 0)     AS acres_burning_50mi
                FROM utility_circuits uc
                CROSS JOIN LATERAL (
                    SELECT acres_burned
                    FROM incidents i
                    WHERE i.is_active = TRUE
                      AND i.latitude IS NOT NULL
                      AND ST_DWithin(
                            uc.geom_point::geography,
                            ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326)::geography,
                            80467  -- 50 miles in metres
                          )
                ) i
                WHERE uc.geom_point IS NOT NULL
                GROUP BY uc.circuit_id
            """),
            db.bind,
        )
        logger.info("Incident proximity (geospatial): %d circuits", len(df))
        if not df.empty:
            # Also get PSA-level lagged activity
            psa_df = pd.read_sql(
                text("""
                    SELECT psa_id,
                        COUNT(*) FILTER (WHERE discovery_date >= :d30)  AS psa_fires_30d,
                        COALESCE(SUM(acres_burned) FILTER (WHERE discovery_date >= :d30), 0) AS psa_acres_30d,
                        COUNT(*) FILTER (WHERE discovery_date >= :d60)  AS psa_fires_60d,
                        COALESCE(SUM(acres_burned) FILTER (WHERE discovery_date >= :d60), 0) AS psa_acres_60d,
                        COUNT(*) FILTER (WHERE discovery_date >= :d90)  AS psa_fires_90d,
                        COALESCE(SUM(acres_burned) FILTER (WHERE discovery_date >= :d90), 0) AS psa_acres_90d
                    FROM incidents
                    WHERE is_active = TRUE AND psa_id IS NOT NULL AND psa_id != ''
                    GROUP BY psa_id
                """),
                db.bind,
                params={
                    "d30": str(prediction_date - timedelta(days=30)),
                    "d60": str(prediction_date - timedelta(days=60)),
                    "d90": str(prediction_date - timedelta(days=90)),
                },
            )
            # We return circuit-level proximity; PSA-level lags merged separately
            return df, psa_df
    except Exception as e:
        logger.debug("Geospatial incident query failed, falling back to PSA: %s", e)

    # Fallback: PSA-based grouping
    try:
        df = pd.read_sql(
            text("""
                SELECT
                    psa_id,
                    COUNT(*)                           AS active_incidents_50mi,
                    COALESCE(SUM(acres_burned), 0)     AS acres_burning_50mi,
                    COUNT(*) FILTER (WHERE discovery_date >= :d30)  AS psa_fires_30d,
                    COALESCE(SUM(acres_burned) FILTER (WHERE discovery_date >= :d30), 0) AS psa_acres_30d,
                    COUNT(*) FILTER (WHERE discovery_date >= :d60)  AS psa_fires_60d,
                    COALESCE(SUM(acres_burned) FILTER (WHERE discovery_date >= :d60), 0) AS psa_acres_60d,
                    COUNT(*) FILTER (WHERE discovery_date >= :d90)  AS psa_fires_90d,
                    COALESCE(SUM(acres_burned) FILTER (WHERE discovery_date >= :d90), 0) AS psa_acres_90d
                FROM incidents
                WHERE is_active = TRUE AND psa_id IS NOT NULL AND psa_id != ''
                GROUP BY psa_id
            """),
            db.bind,
            params={
                "d30": str(prediction_date - timedelta(days=30)),
                "d60": str(prediction_date - timedelta(days=60)),
                "d90": str(prediction_date - timedelta(days=90)),
            },
        )
        logger.info("Incident proximity (PSA fallback): %d PSAs", len(df))
        return df
    except Exception as e:
        logger.debug("Incident proximity query failed: %s", e)
        return pd.DataFrame()


def _get_perimeter_proximity(prediction_date: date, db) -> pd.DataFrame:
    """
    Get nearest fire perimeter distance per circuit using geom_point,
    plus total perimeter acres within proximity.
    Falls back to PSA-based join when geom_point is unavailable.
    """
    try:
        df = pd.read_sql(
            text("""
                SELECT
                    uc.circuit_id,
                    COUNT(DISTINCT p.incident_id)        AS perimeters_active,
                    COALESCE(SUM(GREATEST(p.gis_acres, p.map_acres)), 0) AS perimeter_total_acres,
                    MIN(ST_Distance(
                        uc.geom_point::geography,
                        ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326)::geography
                    ) / 1609.34) AS nearest_perimeter_mi
                FROM utility_circuits uc
                JOIN incidents i ON i.is_active = TRUE AND i.latitude IS NOT NULL
                JOIN perimeters p ON p.incident_id = i.incident_id
                    AND p.date_current >= :lookback
                WHERE uc.geom_point IS NOT NULL
                  AND ST_DWithin(
                        uc.geom_point::geography,
                        ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326)::geography,
                        160934  -- 100 miles in metres
                      )
                GROUP BY uc.circuit_id
            """),
            db.bind,
            params={"lookback": str(prediction_date - timedelta(days=7))},
        )
        logger.info("Perimeter proximity (geospatial): %d circuits", len(df))
        if not df.empty:
            return df
    except Exception as e:
        logger.debug("Geospatial perimeter query failed, falling back to PSA: %s", e)

    # Fallback: PSA-based
    try:
        df = pd.read_sql(
            text("""
                SELECT i.psa_id,
                       COUNT(DISTINCT p.incident_id) AS perimeters_active,
                       COALESCE(SUM(GREATEST(p.gis_acres, p.map_acres)), 0) AS perimeter_total_acres
                FROM perimeters p
                JOIN incidents i ON i.incident_id = p.incident_id
                WHERE i.is_active = TRUE
                  AND i.psa_id IS NOT NULL AND i.psa_id != ''
                  AND p.date_current >= :lookback
                GROUP BY i.psa_id
            """),
            db.bind,
            params={"lookback": str(prediction_date - timedelta(days=7))},
        )
        logger.info("Perimeter proximity (PSA fallback): %d PSAs", len(df))
        return df
    except Exception as e:
        logger.debug("Perimeter proximity query failed: %s", e)
        return pd.DataFrame()


def _get_fault_history(prediction_date: date, db) -> pd.DataFrame:
    """Count faults (90d) and ignitions (365d) per circuit."""
    try:
        df = pd.read_sql(
            text("""
                SELECT circuit_id,
                       COUNT(*) FILTER (WHERE event_date >= :d90)  AS faults_90d,
                       COUNT(*) FILTER (WHERE confirmed_ignition = TRUE
                                         AND event_date >= :d365)  AS ignitions_365d
                FROM faults_ignitions
                WHERE circuit_id IS NOT NULL
                GROUP BY circuit_id
            """),
            db.bind,
            params={
                "d90": str(prediction_date - timedelta(days=90)),
                "d365": str(prediction_date - timedelta(days=365)),
            },
        )
        logger.info("Fault history: %d circuits", len(df))
        return df
    except Exception as e:
        logger.debug("Fault history query failed: %s", e)
        return pd.DataFrame()


def _get_customer_density(db) -> pd.DataFrame:
    """
    Aggregate customer metrics per PSA from the utility_circuits table
    (customer_count, critical_customers) and augment with any data from
    the Supabase customers table if ZIP→PSA mapping is available.
    """
    try:
        df = pd.read_sql(
            text("""
                SELECT psa_id,
                       SUM(customer_count)     AS customer_count,
                       SUM(critical_customers) AS critical_customer_count,
                       CASE WHEN SUM(customer_count) > 0
                            THEN ROUND(SUM(critical_customers)::NUMERIC / SUM(customer_count), 4)
                            ELSE 0 END AS medical_baseline_pct,
                       CASE WHEN COUNT(*) > 0
                            THEN ROUND(COUNT(*) FILTER (WHERE hftd_tier >= 2)::NUMERIC / COUNT(*), 4)
                            ELSE 0 END AS hftd_customer_pct
                FROM utility_circuits
                WHERE psa_id IS NOT NULL AND psa_id != ''
                GROUP BY psa_id
            """),
            db.bind,
        )
        logger.info("Customer density: %d PSAs", len(df))
        return df
    except Exception as e:
        logger.debug("Customer density query failed: %s", e)
        return pd.DataFrame()


# ---------------------------------------------------------------------------
# 3. Synthetic fallback (unchanged from original)
# ---------------------------------------------------------------------------

def _generate_synthetic(prediction_date: date, db) -> pd.DataFrame:
    """
    Generate realistic synthetic feature rows from the utility_circuits table
    so that scoring works even without real data or a pre-computed feature store.
    """
    circuits = _load_circuits(db)
    if circuits.empty:
        return pd.DataFrame()

    rng = np.random.default_rng(int(prediction_date.toordinal()))
    rows = []
    for _, c in circuits.iterrows():
        tier = int(c.get("hftd_tier", 2))
        risk_boost = 0.1 * (tier - 1)

        rows.append({
            "circuit_id": c["circuit_id"],
            "psa_id": c.get("psa_id", "UNKNOWN"),
            "voltage_kv": float(c.get("voltage_kv", 69.0)),
            "hftd_tier": tier,
            "length_miles": float(c.get("length_miles", 20.0)),
            "utility_name": c.get("utility_name", ""),
            # 7-Day outlook
            "fp_7day_d1": int(rng.integers(1, 5)),
            "fp_7day_d2": int(rng.integers(1, 5)),
            "fp_7day_d3": int(rng.integers(1, 5)),
            "fp_7day_d4": int(rng.integers(1, 5)),
            "fp_7day_d5": int(rng.integers(1, 5)),
            "fp_7day_d6": int(rng.integers(1, 5)),
            "fp_7day_d7": int(rng.integers(1, 5)),
            "fp_7day_max": int(rng.integers(2, 6)),
            "fp_7day_mean": round(float(rng.uniform(1.5, 4.0)), 2),
            "fp_7day_trend": round(float(rng.uniform(-1, 1)), 2),
            # Monthly outlook
            "fp_monthly_m1": int(rng.integers(1, 5)),
            "fp_monthly_m2": int(rng.integers(1, 5)),
            "fp_monthly_m3": int(rng.integers(1, 5)),
            # Weather / fuels
            "max_temp_f": round(float(rng.uniform(70, 110) + risk_boost * 5), 1),
            "min_rh_pct": round(float(rng.uniform(5, 35) - risk_boost * 5), 1),
            "max_wind_mph": round(float(rng.uniform(8, 55)), 1),
            "max_gust_mph": round(float(rng.uniform(15, 75)), 1),
            "erc_max": round(float(rng.uniform(30, 95)), 1),
            "bi_max": round(float(rng.uniform(15, 75)), 1),
            "ffwi_max": round(float(rng.uniform(2, 45)), 1),
            # PSA risk context
            "psa_risk_score": round(float(rng.uniform(0.1, 0.8) + risk_boost), 4),
            # Lagged activity
            "psa_acres_30d": round(float(rng.uniform(0, 3000)), 0),
            "psa_acres_60d": round(float(rng.uniform(0, 6000)), 0),
            "psa_acres_90d": round(float(rng.uniform(0, 10000)), 0),
            "psa_fires_30d": int(rng.integers(0, 5)),
            "psa_fires_60d": int(rng.integers(0, 10)),
            "psa_fires_90d": int(rng.integers(0, 15)),
            # Incident proximity
            "active_incidents_50mi": int(rng.integers(0, 6)),
            "acres_burning_50mi": round(float(rng.uniform(0, 4000)), 0),
            # Perimeter data
            "perimeters_active": int(rng.integers(0, 3)),
            "perimeter_total_acres": round(float(rng.uniform(0, 5000)), 0),
            # Customer density
            "customer_count": int(rng.integers(500, 15000)),
            "critical_customer_count": int(rng.integers(0, 200)),
            "medical_baseline_pct": round(float(rng.uniform(0, 0.15)), 4),
            "hftd_customer_pct": round(float(rng.uniform(0, 1)), 4),
            # Historical faults
            "faults_90d": int(rng.integers(0, 4)),
            "ignitions_365d": int(rng.integers(0, 2)),
            # Red flag
            "is_red_flag": int(rng.random() < 0.1),
        })

    return pd.DataFrame(rows)
