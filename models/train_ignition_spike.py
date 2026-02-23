"""
models/train_ignition_spike.py
================================
Model B: Circuit × Day Ignition Spike Risk (24–72 hour horizon)

Label definition (from faults_ignitions table):
  ignition_spike = 1 if circuit had a confirmed_ignition on that day
  OR: synthetic label if no ignition history (phase 1 bootstrap)

Features:
  - PSA risk from Model A (prob_above_normal)
  - 7-Day outlook Day 1–3 fire potential
  - Forecast weather (ERC, BI, FFWI, temp, RH, wind, gust)
  - Circuit attributes (hftd_tier, length_miles, voltage_kv)
  - Historical faults/ignitions on circuit (last 90d, 365d)
  - Active fires in proximity (count, acres)
  - Seasonality

Output: models/artifacts/ignition_spike_model.pkl
         models/artifacts/ignition_spike_meta.json

Usage:
  python models/train_ignition_spike.py
  python models/train_ignition_spike.py --lookback-days 365 --synthetic
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

MODEL_PATH = Path(settings.MODEL_DIR) / "ignition_spike_model.pkl"
META_PATH  = Path(settings.MODEL_DIR) / "ignition_spike_meta.json"

FEATURE_COLS = [
    # 7-Day outlook (next 72h)
    "fp_7day_d1", "fp_7day_d2", "fp_7day_d3",
    # Model A context
    "psa_risk_score",
    # Fire weather
    "max_temp_f", "min_rh_pct",
    "max_wind_mph", "max_gust_mph",
    "erc_max", "bi_max", "ffwi_max",
    # Circuit attributes
    "hftd_tier", "length_miles", "voltage_kv",
    # Incident proximity
    "active_incidents_50mi", "acres_burning_50mi",
    # Historical
    "faults_90d", "ignitions_365d",
    # Seasonality
    "month_sin", "month_cos",
    "month_of_year",
    # Red flag
    "is_red_flag_int",
]

# Horizon-based score decay factors
HORIZON_DECAY = {"24h": 1.0, "48h": 0.90, "72h": 0.80}

RISK_THRESHOLDS = [
    (0.75, "CRITICAL"),
    (0.50, "HIGH"),
    (0.30, "MODERATE"),
    (0.0,  "LOW"),
]


def _risk_bucket(score: float) -> str:
    for thresh, label in RISK_THRESHOLDS:
        if score >= thresh:
            return label
    return "LOW"


# ── Label loading ──────────────────────────────────────────────────
def load_labels(db) -> pd.DataFrame:
    """Load ignition labels from faults_ignitions table."""
    df = pd.read_sql(
        text("""
            SELECT
                circuit_id,
                event_date,
                MAX(confirmed_ignition::INT) AS ignition_spike
            FROM faults_ignitions
            WHERE event_type IN ('ignition', 'fault')
            GROUP BY circuit_id, event_date
        """),
        db.bind,
    )
    if df.empty:
        logger.warning("No ignition/fault records — generating synthetic labels.")
        return _synthetic_labels()
    return df


def _synthetic_labels() -> pd.DataFrame:
    """Bootstrap labels for phase-1 development."""
    rng = np.random.default_rng(99)
    today = date.today()
    rows = []
    for circuit_num in range(1, 51):
        cid = f"C{circuit_num:03d}"
        for day_offset in range(365):
            d = today - timedelta(days=day_offset)
            # Spike probability ~3% (realistic wildfire ignition rate)
            rows.append({
                "circuit_id": cid,
                "event_date": d,
                "ignition_spike": int(rng.random() < 0.03),
            })
    return pd.DataFrame(rows)


# ── Feature loading ────────────────────────────────────────────────
def load_features(db, lookback_days: int) -> pd.DataFrame:
    cutoff = date.today() - timedelta(days=lookback_days)
    df = pd.read_sql(
        text("""
            SELECT
                cf.*,
                uc.psa_id,
                uc.voltage_kv,
                COALESCE(mp.prob_score, 0) AS psa_risk_score
            FROM circuit_features cf
            JOIN utility_circuits uc ON uc.circuit_id = cf.circuit_id
            LEFT JOIN LATERAL (
                SELECT prob_score FROM model_predictions
                WHERE circuit_id = cf.circuit_id
                  AND model_name = 'psa_risk'
                  AND prediction_date = cf.feature_date
                ORDER BY predicted_at DESC
                LIMIT 1
            ) mp ON TRUE
            WHERE cf.feature_date >= :cutoff
        """),
        db.bind,
        params={"cutoff": str(cutoff)},
    )
    if df.empty:
        logger.warning("No circuit features — using synthetic.")
        return _synthetic_features()

    # Derived
    df["month_of_year"] = pd.to_datetime(df["feature_date"]).dt.month
    df["month_sin"] = np.sin(2 * np.pi * df["month_of_year"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month_of_year"] / 12)
    df["is_red_flag_int"] = df.get("is_red_flag", False).astype(int)
    df["psa_risk_score"] = df.get("psa_risk_score", pd.Series(0.0, index=df.index))
    df["feature_date"] = pd.to_datetime(df["feature_date"]).dt.date
    df["voltage_kv"] = df.get("voltage_kv", pd.Series(69.0, index=df.index))
    return df


def _synthetic_features() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    today = date.today()
    rows = []
    for circuit_num in range(1, 51):
        cid = f"C{circuit_num:03d}"
        for day_offset in range(365):
            d = today - timedelta(days=day_offset)
            rows.append({
                "circuit_id": cid,
                "psa_id": f"PSA_{(circuit_num % 5) + 1}",
                "feature_date": d,
                "fp_7day_d1": int(rng.integers(1, 6)),
                "fp_7day_d2": int(rng.integers(1, 6)),
                "fp_7day_d3": int(rng.integers(1, 6)),
                "psa_risk_score": float(rng.uniform(0, 1)),
                "max_temp_f": float(rng.uniform(60, 115)),
                "min_rh_pct": float(rng.uniform(4, 40)),
                "max_wind_mph": float(rng.uniform(5, 65)),
                "max_gust_mph": float(rng.uniform(10, 85)),
                "erc_max": float(rng.uniform(20, 100)),
                "bi_max": float(rng.uniform(10, 80)),
                "ffwi_max": float(rng.uniform(1, 50)),
                "hftd_tier": int(rng.choice([2, 3])),
                "length_miles": float(rng.uniform(5, 80)),
                "voltage_kv": float(rng.choice([12.0, 21.0, 69.0, 115.0])),
                "active_incidents_50mi": int(rng.integers(0, 8)),
                "acres_burning_50mi": float(rng.uniform(0, 5000)),
                "faults_90d": int(rng.integers(0, 5)),
                "ignitions_365d": int(rng.integers(0, 3)),
                "month_of_year": d.month,
                "month_sin": np.sin(2 * np.pi * d.month / 12),
                "month_cos": np.cos(2 * np.pi * d.month / 12),
                "is_red_flag_int": int(rng.random() < 0.1),
            })
    return pd.DataFrame(rows)


# ── Training ───────────────────────────────────────────────────────
def train(lookback_days: int = 730, eval_split: float = 0.2, force_synthetic: bool = False) -> dict:
    try:
        import lightgbm as lgb
        USE_LGB = True
    except ImportError:
        import xgboost as xgb
        USE_LGB = False

    db = SessionLocal()
    try:
        if force_synthetic:
            df_feat = _synthetic_features()
            df_labels = _synthetic_labels()
        else:
            df_feat = load_features(db, lookback_days)
            df_labels = load_labels(db)

        # Join on circuit_id + feature_date/event_date
        df_feat["feature_date_d"] = pd.to_datetime(df_feat["feature_date"]).dt.date
        df_labels["event_date_d"] = pd.to_datetime(df_labels["event_date"]).dt.date
        df = df_feat.merge(
            df_labels,
            left_on=["circuit_id", "feature_date_d"],
            right_on=["circuit_id", "event_date_d"],
            how="left",
        )
        df["ignition_spike"] = df["ignition_spike"].fillna(0).astype(int)

        logger.info(
            "Training Model B on %d samples (ignition_rate=%.2f%%)",
            len(df), 100 * df["ignition_spike"].mean(),
        )

        df = df.sort_values("feature_date")
        split_idx = int(len(df) * (1 - eval_split))
        X_train = df.iloc[:split_idx][FEATURE_COLS].fillna(0)
        y_train = df.iloc[:split_idx]["ignition_spike"]
        X_val   = df.iloc[split_idx:][FEATURE_COLS].fillna(0)
        y_val   = df.iloc[split_idx:]["ignition_spike"]

        pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)

        if USE_LGB:
            model = lgb.LGBMClassifier(
                n_estimators=500,
                learning_rate=0.03,
                max_depth=7,
                num_leaves=40,
                class_weight="balanced",
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_samples=15,
                reg_alpha=0.1,
                reg_lambda=0.1,
                random_state=42,
            )
        else:
            model = xgb.XGBClassifier(
                n_estimators=500,
                learning_rate=0.03,
                max_depth=7,
                scale_pos_weight=pos_weight,
                subsample=0.8,
                colsample_bytree=0.8,
                eval_metric="aucpr",
                random_state=42,
            )

        model.fit(X_train, y_train)

        from sklearn.metrics import roc_auc_score, average_precision_score
        y_prob = model.predict_proba(X_val)[:, 1]
        auc = roc_auc_score(y_val, y_prob) if len(y_val.unique()) > 1 else 0.0
        ap  = average_precision_score(y_val, y_prob) if len(y_val.unique()) > 1 else 0.0

        fi = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
        top_features = dict(sorted(fi.items(), key=lambda x: -x[1])[:10])

        Path(settings.MODEL_DIR).mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(model, f)

        meta = {
            "model_name": "ignition_spike",
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
            "horizon_decay": HORIZON_DECAY,
            "risk_thresholds": RISK_THRESHOLDS,
        }
        with open(META_PATH, "w") as f:
            json.dump(meta, f, indent=2)

        logger.info("✓ Model B saved: AUC=%.3f AP=%.3f  %s", auc, ap, MODEL_PATH)
        return {"status": "success", **meta}
    finally:
        db.close()


# ── Inference ──────────────────────────────────────────────────────
def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def predict(
    features_df: pd.DataFrame,
    model=None,
    horizons: list = None,
) -> pd.DataFrame:
    """
    Score circuits. Returns df with prob_spike_{24h,48h,72h}, risk_band, top_drivers.
    """
    if horizons is None:
        horizons = ["24h", "48h", "72h"]
    if model is None:
        model = load_model()

    X = features_df.reindex(columns=FEATURE_COLS).fillna(0)
    base_probs = model.predict_proba(X)[:, 1]

    result = features_df.copy()
    for h in horizons:
        decay = HORIZON_DECAY.get(h, 1.0)
        result[f"prob_spike_{h}"] = np.round(base_probs * decay, 4)

    result["prob_spike"] = np.round(base_probs, 4)
    result["risk_band"] = [_risk_bucket(p) for p in base_probs]

    importances = model.feature_importances_
    drivers_list = []
    for _, row in X.iterrows():
        contribs = sorted(
            zip(FEATURE_COLS, importances * abs(row.values)),
            key=lambda x: -x[1],
        )[:5]
        drivers_list.append({k: round(float(v), 3) for k, v in contribs})
    result["top_drivers"] = drivers_list

    return result


def score_and_store(prediction_date=None) -> int:
    """Score and store predictions for all horizons."""
    from features.feature_builder import build_features_for_date
    from sqlalchemy import text as sqlt

    if prediction_date is None:
        prediction_date = date.today()

    db = SessionLocal()
    try:
        model = load_model()
        df = build_features_for_date(prediction_date, db)
        if df.empty:
            return 0

        df = predict(df, model)
        rows = []
        for _, row in df.iterrows():
            for h in ["24h", "48h", "72h"]:
                rows.append({
                    "model_name": "ignition_spike",
                    "model_version": "v1",
                    "circuit_id": row.get("circuit_id"),
                    "psa_id": row.get("psa_id"),
                    "prediction_date": str(prediction_date),
                    "horizon_label": h,
                    "prob_score": float(row[f"prob_spike_{h}"]),
                    "risk_bucket": row["risk_band"],
                    "top_drivers": json.dumps(row.get("top_drivers", {})),
                })

        db.execute(
            sqlt("""
                INSERT INTO model_predictions
                    (model_name, model_version, circuit_id, psa_id, prediction_date,
                     horizon_label, prob_score, risk_bucket, top_drivers)
                VALUES
                    (:model_name, :model_version, :circuit_id, :psa_id, :prediction_date::DATE,
                     :horizon_label, :prob_score, :risk_bucket, :top_drivers::JSONB)
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
    parser = argparse.ArgumentParser(description="Train Model B: Circuit Ignition Spike Risk")
    parser.add_argument("--lookback-days", type=int, default=730)
    parser.add_argument("--eval-split", type=float, default=0.2)
    parser.add_argument("--synthetic", action="store_true",
                        help="Force synthetic data (phase-1 bootstrap)")
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    result = train(
        lookback_days=args.lookback_days,
        eval_split=args.eval_split,
        force_synthetic=args.synthetic,
    )
    print(json.dumps({k: v for k, v in result.items() if k != "feature_cols"}, indent=2))
