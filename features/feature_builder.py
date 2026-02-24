"""
features/feature_builder.py
=============================
Builds a scored feature DataFrame for a given prediction date, suitable
for both Model A (psa_risk) and Model B (ignition_spike) inference.

Pulls from:
  - circuit_features  (daily ML features per circuit)
  - utility_circuits  (circuit static attributes)
  - model_predictions (Model A score, used as input to Model B)
  - incidents         (proximity context)

Returns a DataFrame with all columns needed by both models' FEATURE_COLS.
Falls back to synthetic data if no circuit_features rows exist.
"""
import logging
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# How far back to look for the most recent feature row per circuit
_MAX_STALENESS_DAYS = 3


def build_features_for_date(prediction_date: date, db: Session) -> pd.DataFrame:
    """
    Return a feature DataFrame for inference on `prediction_date`.

    Each row represents one circuit with all derived features populated.
    Returns an empty DataFrame if no data is available and synthetic
    fallback is disabled.
    """
    cutoff = prediction_date - timedelta(days=_MAX_STALENESS_DAYS)

    df = pd.read_sql(
        text("""
            SELECT DISTINCT ON (cf.circuit_id)
                cf.*,
                uc.psa_id,
                uc.voltage_kv,
                uc.hftd_tier         AS uc_hftd_tier,
                uc.length_miles      AS uc_length_miles,
                COALESCE(mp.prob_score, 0.0) AS psa_risk_score,
                COALESCE(inc.active_count, 0) AS active_incidents_50mi_live,
                COALESCE(inc.total_acres, 0)  AS acres_burning_50mi_live
            FROM circuit_features cf
            JOIN utility_circuits uc ON uc.circuit_id = cf.circuit_id
            LEFT JOIN LATERAL (
                SELECT prob_score
                FROM model_predictions
                WHERE circuit_id = cf.circuit_id
                  AND model_name = 'psa_risk'
                  AND prediction_date = :pred_date
                ORDER BY predicted_at DESC
                LIMIT 1
            ) mp ON TRUE
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS active_count, COALESCE(SUM(acres_burned), 0) AS total_acres
                FROM incidents
                WHERE psa_id = uc.psa_id AND is_active = TRUE
            ) inc ON TRUE
            WHERE cf.feature_date BETWEEN :cutoff AND :pred_date
            ORDER BY cf.circuit_id, cf.feature_date DESC
        """),
        db.bind,
        params={"pred_date": str(prediction_date), "cutoff": str(cutoff)},
    )

    if df.empty:
        logger.warning(
            "No circuit_features rows for %s (lookback %s). Returning empty DataFrame.",
            prediction_date, cutoff,
        )
        return df

    # Prefer live incident context over stale feature-store values when available
    df["active_incidents_50mi"] = df["active_incidents_50mi_live"].fillna(
        df.get("active_incidents_50mi", pd.Series(0, index=df.index))
    )
    df["acres_burning_50mi"] = df["acres_burning_50mi_live"].fillna(
        df.get("acres_burning_50mi", pd.Series(0.0, index=df.index))
    )

    # Prefer utility_circuits static values (authoritative) over feature-store copies
    df["hftd_tier"] = df["uc_hftd_tier"].fillna(df.get("hftd_tier", pd.Series(2, index=df.index)))
    df["length_miles"] = df["uc_length_miles"].fillna(df.get("length_miles", pd.Series(0.0, index=df.index)))

    # Derived: 7-day outlook aggregates
    day_cols = [f"fp_7day_d{i}" for i in range(1, 8)]
    existing_day_cols = [c for c in day_cols if c in df.columns]
    if existing_day_cols:
        df["fp_7day_max"] = df[existing_day_cols].max(axis=1).fillna(0)
        df["fp_7day_mean"] = df[existing_day_cols].mean(axis=1).fillna(0)
        d1 = df.get("fp_7day_d1", pd.Series(0, index=df.index)).fillna(0)
        d7 = df.get("fp_7day_d7", pd.Series(0, index=df.index)).fillna(0)
        df["fp_7day_trend"] = d7 - d1
    else:
        df["fp_7day_max"] = 0.0
        df["fp_7day_mean"] = 0.0
        df["fp_7day_trend"] = 0.0

    # Derived: seasonality
    feature_dt = pd.to_datetime(df["feature_date"])
    df["month_of_year"] = feature_dt.dt.month
    df["day_of_year_num"] = feature_dt.dt.dayofyear
    df["month_sin"] = np.sin(2 * np.pi * df["month_of_year"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month_of_year"] / 12)
    df["day_sin"] = np.sin(2 * np.pi * df["day_of_year_num"] / 365)
    df["day_cos"] = np.cos(2 * np.pi * df["day_of_year_num"] / 365)

    # Derived: red flag integer
    df["is_red_flag_int"] = df.get("is_red_flag", False).fillna(False).astype(int)

    # Derived: lagged PSA activity approximations from available feature-store cols
    df["psa_acres_30d"] = df["acres_burning_50mi"].fillna(0)
    df["psa_acres_60d"] = df["psa_acres_30d"] * 1.5
    df["psa_acres_90d"] = df["psa_acres_30d"] * 2.0
    df["psa_fires_30d"] = df["active_incidents_50mi"].fillna(0)
    df["psa_fires_60d"] = df["psa_fires_30d"]
    df["psa_fires_90d"] = df["psa_fires_30d"]

    # voltage_kv default if missing
    df["voltage_kv"] = df.get("voltage_kv", pd.Series(69.0, index=df.index)).fillna(69.0)

    # faults / ignitions default if not in feature store
    df["faults_90d"] = df.get("faults_90d", pd.Series(0, index=df.index)).fillna(0)
    df["ignitions_365d"] = df.get("ignitions_365d", pd.Series(0, index=df.index)).fillna(0)

    logger.info(
        "Built feature matrix: %d circuits for prediction_date=%s",
        len(df), prediction_date,
    )
    return df
