"""
models/train_psa_risk.py
=========================
Model A: PSA × Month Above-Normal Wildfire Activity Risk (1–3 month horizon)

Label definition (computed from incidents + perimeters):
  above_normal_activity = 1 if PSA×month acres_burned > historical median
                          OR count of large fires (≥300 acres) > historical median

Features:
  - 7-Day outlook fire potential (Day 1–7 avg, max, trend)
  - Monthly outlook (Month 1–4 fire potential values)
  - Seasonality (month_of_year, day_of_year sin/cos)
  - Lagged PSA activity (acres/fires in prior 30, 60, 90 days)
  - RAWS weather indices (ERC, BI, FFWI, max temp, min RH)

Output: models/artifacts/psa_risk_model.pkl
         models/artifacts/psa_risk_meta.json

Usage:
  python models/train_psa_risk.py
  python models/train_psa_risk.py --lookback-days 730 --eval-split 0.2
"""
import argparse
import json
import logging
import pickle
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent.parent))

from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

MODEL_PATH = Path(settings.MODEL_DIR) / "psa_risk_model.pkl"
META_PATH  = Path(settings.MODEL_DIR) / "psa_risk_meta.json"

FEATURE_COLS = [
    # 7-Day outlook
    "fp_7day_d1", "fp_7day_d2", "fp_7day_d3",
    "fp_7day_d4", "fp_7day_d5", "fp_7day_d6", "fp_7day_d7",
    "fp_7day_max", "fp_7day_mean", "fp_7day_trend",
    # Monthly outlook
    "fp_monthly_m1", "fp_monthly_m2", "fp_monthly_m3",
    # Weather/fuels
    "erc_max", "bi_max", "ffwi_max",
    "max_temp_f", "min_rh_pct", "max_wind_mph",
    # Lagged activity
    "psa_acres_30d", "psa_acres_60d", "psa_acres_90d",
    "psa_fires_30d", "psa_fires_60d", "psa_fires_90d",
    # Seasonality
    "month_sin", "month_cos", "day_sin", "day_cos",
    "month_of_year",
    # Circuit/PSA static
    "hftd_tier", "length_miles",
]

RISK_THRESHOLDS = [
    (0.70, "CRITICAL"),
    (0.50, "HIGH"),
    (0.30, "MODERATE"),
    (0.0,  "LOW"),
]


def _risk_bucket(score: float) -> str:
    for thresh, label in RISK_THRESHOLDS:
        if score >= thresh:
            return label
    return "LOW"


# ── Label computation ──────────────────────────────────────────────
def compute_labels(db) -> pd.DataFrame:
    """
    Compute above_normal_activity label per PSA × month from incidents table.
    Returns DataFrame with columns: psa_id, year_month, above_normal_activity
    """
    df_incidents = pd.read_sql(
        text("""
            SELECT
                psa_id,
                DATE_TRUNC('month', discovery_date)::DATE AS year_month,
                COUNT(*) AS fire_count,
                COALESCE(SUM(acres_burned), 0) AS total_acres
            FROM incidents
            WHERE discovery_date IS NOT NULL
              AND psa_id IS NOT NULL
              AND psa_id != ''
            GROUP BY psa_id, DATE_TRUNC('month', discovery_date)::DATE
        """),
        db.bind,
    )
    if df_incidents.empty:
        logger.warning("No incident data — generating synthetic labels for development.")
        return _synthetic_labels()

    # Compute per-PSA historical medians
    medians = df_incidents.groupby("psa_id").agg(
        median_acres=("total_acres", "median"),
        median_fires=("fire_count", "median"),
    ).reset_index()

    df = df_incidents.merge(medians, on="psa_id", how="left")
    df["above_normal_activity"] = (
        (df["total_acres"] > df["median_acres"]) |
        (df["fire_count"] > df["median_fires"])
    ).astype(int)

    return df[["psa_id", "year_month", "above_normal_activity"]]


def _synthetic_labels() -> pd.DataFrame:
    """Generate synthetic labels for development when no incident history exists."""
    import random
    random.seed(42)
    rows = []
    today = date.today()
    for month_offset in range(24):
        d = today - timedelta(days=30 * month_offset)
        for psa in [f"PSA_{i}" for i in range(1, 20)]:
            rows.append({
                "psa_id": psa,
                "year_month": date(d.year, d.month, 1),
                "above_normal_activity": random.randint(0, 1),
            })
    return pd.DataFrame(rows)


# ── Feature loading ────────────────────────────────────────────────
def load_features(db, lookback_days: int) -> pd.DataFrame:
    """Load feature rows from circuit_features with PSA rollup."""
    cutoff = date.today() - timedelta(days=lookback_days)
    df = pd.read_sql(
        text("""
            SELECT
                cf.*,
                uc.psa_id,
                uc.voltage_kv
            FROM circuit_features cf
            JOIN utility_circuits uc ON uc.circuit_id = cf.circuit_id
            WHERE cf.feature_date >= :cutoff
        """),
        db.bind,
        params={"cutoff": str(cutoff)},
    )
    if df.empty:
        logger.warning("No feature rows — generating synthetic features.")
        return _synthetic_features()

    # Rollup to PSA level (average across circuits per PSA per day)
    df["year_month"] = pd.to_datetime(df["feature_date"]).dt.to_period("M").dt.to_timestamp().dt.date

    # Derived features
    day_cols = [f"fp_7day_d{i}" for i in range(1, 8)]
    df["fp_7day_max"] = df[day_cols].max(axis=1).fillna(0)
    df["fp_7day_mean"] = df[day_cols].mean(axis=1).fillna(0)
    df["fp_7day_trend"] = df[["fp_7day_d1", "fp_7day_d7"]].apply(
        lambda r: (r["fp_7day_d7"] or 0) - (r["fp_7day_d1"] or 0), axis=1
    )

    # Seasonality
    df["month_of_year"] = pd.to_datetime(df["feature_date"]).dt.month
    df["day_of_year_num"] = pd.to_datetime(df["feature_date"]).dt.dayofyear
    df["month_sin"] = np.sin(2 * np.pi * df["month_of_year"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month_of_year"] / 12)
    df["day_sin"] = np.sin(2 * np.pi * df["day_of_year_num"] / 365)
    df["day_cos"] = np.cos(2 * np.pi * df["day_of_year_num"] / 365)

    # Lagged PSA activity — approximate from feature columns
    df["psa_acres_30d"] = df["acres_burning_50mi"].fillna(0)
    df["psa_acres_60d"] = df["psa_acres_30d"] * 1.5
    df["psa_acres_90d"] = df["psa_acres_30d"] * 2.0
    df["psa_fires_30d"] = df["active_incidents_50mi"].fillna(0)
    df["psa_fires_60d"] = df["psa_fires_30d"]
    df["psa_fires_90d"] = df["psa_fires_30d"]

    return df


def _synthetic_features() -> pd.DataFrame:
    """Synthetic feature data for development."""
    rng = np.random.default_rng(42)
    n = 2000
    today = date.today()
    rows = []
    for i in range(n):
        d = today - timedelta(days=rng.integers(0, 730))
        rows.append({
            "circuit_id": f"C{rng.integers(1, 50):03d}",
            "psa_id": f"PSA_{rng.integers(1, 20)}",
            "feature_date": d,
            "year_month": date(d.year, d.month, 1),
            **{f"fp_7day_d{j}": int(rng.integers(1, 6)) for j in range(1, 8)},
            "fp_7day_max": int(rng.integers(3, 6)),
            "fp_7day_mean": float(rng.uniform(2, 5)),
            "fp_7day_trend": float(rng.uniform(-1, 2)),
            "fp_monthly_m1": int(rng.integers(1, 6)),
            "fp_monthly_m2": int(rng.integers(1, 5)),
            "fp_monthly_m3": int(rng.integers(1, 5)),
            "erc_max": float(rng.uniform(20, 100)),
            "bi_max": float(rng.uniform(10, 80)),
            "ffwi_max": float(rng.uniform(1, 50)),
            "max_temp_f": float(rng.uniform(60, 115)),
            "min_rh_pct": float(rng.uniform(4, 40)),
            "max_wind_mph": float(rng.uniform(5, 65)),
            "psa_acres_30d": float(rng.uniform(0, 5000)),
            "psa_acres_60d": float(rng.uniform(0, 10000)),
            "psa_acres_90d": float(rng.uniform(0, 20000)),
            "psa_fires_30d": int(rng.integers(0, 10)),
            "psa_fires_60d": int(rng.integers(0, 20)),
            "psa_fires_90d": int(rng.integers(0, 30)),
            "month_of_year": d.month,
            "month_sin": np.sin(2 * np.pi * d.month / 12),
            "month_cos": np.cos(2 * np.pi * d.month / 12),
            "day_sin": np.sin(2 * np.pi * d.timetuple().tm_yday / 365),
            "day_cos": np.cos(2 * np.pi * d.timetuple().tm_yday / 365),
            "hftd_tier": int(rng.choice([2, 3])),
            "length_miles": float(rng.uniform(5, 80)),
        })
    return pd.DataFrame(rows)


# ── Training ───────────────────────────────────────────────────────
def train(lookback_days: int = 730, eval_split: float = 0.2) -> dict:
    try:
        import lightgbm as lgb
        USE_LGB = True
    except ImportError:
        import xgboost as xgb
        USE_LGB = False

    db = SessionLocal()
    try:
        df_feat = load_features(db, lookback_days)
        df_labels = compute_labels(db)

        # Join features to labels on psa_id + year_month
        df_feat["year_month"] = pd.to_datetime(df_feat["feature_date"]).dt.to_period("M").dt.to_timestamp().dt.date
        df = df_feat.merge(df_labels, on=["psa_id", "year_month"], how="inner")
        df = df.dropna(subset=["above_normal_activity"])

        if len(df) < 50:
            logger.warning("Only %d labeled rows available. Using synthetic data.", len(df))
            df_feat = _synthetic_features()
            df_labels = _synthetic_labels()
            df_feat["year_month"] = pd.to_datetime(df_feat["feature_date"]).dt.to_period("M").dt.to_timestamp().dt.date
            df = df_feat.merge(df_labels, on=["psa_id", "year_month"], how="inner")

        logger.info("Training Model A on %d samples (pos=%.1f%%)",
                    len(df), 100 * df["above_normal_activity"].mean())

        # Chronological split
        df = df.sort_values("feature_date")
        split_idx = int(len(df) * (1 - eval_split))
        X_train = df.iloc[:split_idx][FEATURE_COLS].fillna(0)
        y_train = df.iloc[:split_idx]["above_normal_activity"]
        X_val   = df.iloc[split_idx:][FEATURE_COLS].fillna(0)
        y_val   = df.iloc[split_idx:]["above_normal_activity"]

        pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

        if USE_LGB:
            model = lgb.LGBMClassifier(
                n_estimators=400,
                learning_rate=0.04,
                max_depth=6,
                num_leaves=31,
                class_weight="balanced",
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_samples=20,
                random_state=42,
            )
        else:
            model = xgb.XGBClassifier(
                n_estimators=400,
                learning_rate=0.04,
                max_depth=6,
                scale_pos_weight=pos_weight,
                subsample=0.8,
                colsample_bytree=0.8,
                eval_metric="logloss",
                random_state=42,
            )

        model.fit(X_train, y_train)

        from sklearn.metrics import roc_auc_score, average_precision_score
        y_prob = model.predict_proba(X_val)[:, 1]
        auc = roc_auc_score(y_val, y_prob) if len(y_val.unique()) > 1 else 0.0
        ap  = average_precision_score(y_val, y_prob) if len(y_val.unique()) > 1 else 0.0

        # Feature importance
        fi = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
        top_features = dict(sorted(fi.items(), key=lambda x: -x[1])[:10])

        Path(settings.MODEL_DIR).mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)

        meta = {
            "model_name": "psa_risk",
            "model_version": "v1",
            "trained_at": date.today().isoformat(),
            "algorithm": "LightGBM" if USE_LGB else "XGBoost",
            "n_train": len(X_train),
            "n_val": len(X_val),
            "auc_roc": round(auc, 4),
            "avg_precision": round(ap, 4),
            "positive_rate": round(float(y_train.mean()), 4),
            "feature_cols": FEATURE_COLS,
            "top_features": top_features,
            "risk_thresholds": RISK_THRESHOLDS,
        }
        with open(META_PATH, "w") as f:
            json.dump(meta, f, indent=2)

        logger.info("✓ Model A saved: AUC=%.3f AP=%.3f  %s", auc, ap, MODEL_PATH)
        return {"status": "success", **meta}
    finally:
        db.close()


# ── Inference ──────────────────────────────────────────────────────
def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}. Run training first.")
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def predict(features_df: pd.DataFrame, model=None) -> pd.DataFrame:
    """Score rows. Returns df with prob_above_normal, risk_bucket, top_drivers."""
    if model is None:
        model = load_model()

    X = features_df.reindex(columns=FEATURE_COLS).fillna(0)
    probs = model.predict_proba(X)[:, 1]

    result = features_df.copy()
    result["prob_above_normal"] = np.round(probs, 4)
    result["risk_bucket"] = [_risk_bucket(p) for p in probs]

    # SHAP-lite: feature importance × feature value direction
    importances = model.feature_importances_
    drivers_list = []
    for _, row in X.iterrows():
        contribs = sorted(
            zip(FEATURE_COLS, importances * row.values),
            key=lambda x: -abs(x[1]),
        )[:5]
        drivers_list.append({k: round(float(v), 3) for k, v in contribs})
    result["top_drivers"] = drivers_list

    return result


def score_and_store(prediction_date=None) -> int:
    """Score all circuits and persist to model_predictions."""
    from features.feature_builder import build_features_for_date
    from sqlalchemy import text as sqlt

    if prediction_date is None:
        prediction_date = date.today()

    db = SessionLocal()
    try:
        model = load_model()
        df = build_features_for_date(prediction_date, db)
        if df.empty:
            logger.warning("No features for PSA risk scoring on %s", prediction_date)
            return 0

        df = predict(df, model)
        rows = []
        for _, row in df.iterrows():
            for offset, label in enumerate(["Month1", "Month2", "Month3"], start=1):
                rows.append({
                    "model_name": "psa_risk",
                    "model_version": "v1",
                    "circuit_id": row.get("circuit_id"),
                    "psa_id": row.get("psa_id"),
                    "prediction_date": str(prediction_date),
                    "horizon_label": label,
                    "prob_score": float(row["prob_above_normal"]),
                    "risk_bucket": row["risk_bucket"],
                    "top_drivers": json.dumps(row.get("top_drivers", {})),
                })

        db.execute(
            sqlt("""
                INSERT INTO model_predictions
                    (model_name, model_version, circuit_id, psa_id, prediction_date,
                     horizon_label, prob_score, risk_bucket, top_drivers)
                VALUES
                    (:model_name, :model_version, :circuit_id, :psa_id, CAST(:prediction_date AS DATE),
                     :horizon_label, :prob_score, :risk_bucket, CAST(:top_drivers AS JSONB))
                ON CONFLICT DO NOTHING
            """),
            rows,
        )
        db.commit()
        return len(rows)
    finally:
        db.close()


# ── CLI ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Model A: PSA Wildfire Activity Risk")
    parser.add_argument("--lookback-days", type=int, default=730)
    parser.add_argument("--eval-split", type=float, default=0.2)
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    result = train(lookback_days=args.lookback_days, eval_split=args.eval_split)
    print(json.dumps({k: v for k, v in result.items() if k != "feature_cols"}, indent=2))
