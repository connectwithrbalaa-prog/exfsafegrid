"""
features/feature_builder.py
============================
Build per-circuit feature rows for a given prediction date.
Used by Model A (psa_risk) and Model B (ignition_spike) scoring pipelines.
"""
import logging
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sqlalchemy import text

logger = logging.getLogger(__name__)


def build_features_for_date(prediction_date: date, db) -> pd.DataFrame:
    """
    Return a DataFrame with one row per circuit containing all features
    needed by both Model A and Model B.

    First tries to load from `circuit_features` table; if empty,
    generates synthetic features from `utility_circuits`.
    """
    # Try loading pre-computed features
    df = pd.read_sql(
        text("""
            SELECT cf.*, uc.psa_id, uc.voltage_kv, uc.utility_name
            FROM circuit_features cf
            JOIN utility_circuits uc ON uc.circuit_id = cf.circuit_id
            WHERE cf.feature_date = :pred_date
        """),
        db.bind,
        params={"pred_date": str(prediction_date)},
    )

    if df.empty:
        logger.info(
            "No pre-computed features for %s — generating from utility_circuits.",
            prediction_date,
        )
        df = _generate_from_circuits(prediction_date, db)

    if df.empty:
        logger.warning("No circuits found — cannot build features.")
        return df

    # Ensure derived columns exist
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


def _generate_from_circuits(prediction_date: date, db) -> pd.DataFrame:
    """
    Generate realistic synthetic feature rows from the utility_circuits table
    so that scoring works even without a pre-computed feature store.
    """
    circuits = pd.read_sql(
        text("SELECT * FROM utility_circuits ORDER BY circuit_id"),
        db.bind,
    )
    if circuits.empty:
        return pd.DataFrame()

    rng = np.random.default_rng(int(prediction_date.toordinal()))
    rows = []
    for _, c in circuits.iterrows():
        tier = int(c.get("hftd_tier", 2))
        # Higher tiers get slightly elevated base risk
        risk_boost = 0.1 * (tier - 1)

        rows.append({
            "circuit_id": c["circuit_id"],
            "psa_id": c.get("psa_id", "UNKNOWN"),
            "voltage_kv": float(c.get("voltage_kv", 69.0)),
            "hftd_tier": tier,
            "length_miles": float(c.get("length_miles", 20.0)),
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
            # Historical faults
            "faults_90d": int(rng.integers(0, 4)),
            "ignitions_365d": int(rng.integers(0, 2)),
            # Red flag
            "is_red_flag": int(rng.random() < 0.1),
        })

    return pd.DataFrame(rows)
