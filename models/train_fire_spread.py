"""
models/train_fire_spread.py
============================
Model C: Fire Spread & Behavior Prediction

Predicts fire behavior metrics for each circuit/incident using
Rothermel-informed features:
  - spread_rate_ch_hr (chains/hour)
  - flame_length_ft
  - spotting_distance_mi

Features:
  - Wind speed, gust, direction
  - Fuel moisture (dead 1h, 10h, 100h; live herbaceous & woody)
  - Terrain slope & aspect
  - Fuel model / vegetation type
  - ERC, BI, FFWI fire indices
  - Temperature, relative humidity
  - Active fire proximity & intensity (FRP)

Output: models/artifacts/fire_spread_model.pkl
         models/artifacts/fire_spread_meta.json

Usage:
  python models/train_fire_spread.py
  python models/train_fire_spread.py --synthetic
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

MODEL_PATH = Path(settings.MODEL_DIR) / "fire_spread_model.pkl"
META_PATH  = Path(settings.MODEL_DIR) / "fire_spread_meta.json"

FEATURE_COLS = [
    # Wind
    "wind_speed_mph", "wind_gust_mph", "wind_dir_deg",
    # Fuel moisture
    "fuel_moisture_1h", "fuel_moisture_10h", "fuel_moisture_100h",
    "fuel_moisture_live_herb", "fuel_moisture_live_woody",
    # Terrain
    "slope_pct", "aspect_deg", "elevation_ft",
    # Fire indices
    "erc_max", "bi_max", "ffwi_max",
    # Weather
    "max_temp_f", "min_rh_pct",
    # Fuel model
    "fuel_model_code",
    # Fire proximity
    "active_incidents_50mi", "acres_burning_50mi",
    "nearest_fire_dist_mi", "nearest_fire_frp",
    # Circuit attributes
    "hftd_tier", "length_miles", "voltage_kv",
    # Seasonality
    "month_sin", "month_cos", "day_sin", "day_cos",
]

# Spread rate severity thresholds (chains/hr)
SPREAD_THRESHOLDS = [
    (60, "EXTREME"),
    (30, "HIGH"),
    (10, "MODERATE"),
    (0,  "LOW"),
]

# Flame length severity thresholds (ft)
FLAME_THRESHOLDS = [
    (11, "EXTREME"),
    (6,  "HIGH"),
    (3,  "MODERATE"),
    (0,  "LOW"),
]


def _spread_bucket(rate: float) -> str:
    for thresh, label in SPREAD_THRESHOLDS:
        if rate >= thresh:
            return label
    return "LOW"


def _flame_bucket(length: float) -> str:
    for thresh, label in FLAME_THRESHOLDS:
        if length >= thresh:
            return label
    return "LOW"


# ── Label loading ──────────────────────────────────────────────────
def _synthetic_labels() -> pd.DataFrame:
    """Generate synthetic fire behavior labels for training."""
    rng = np.random.default_rng(77)
    today = date.today()
    rows = []
    for circuit_num in range(1, 51):
        cid = f"C{circuit_num:03d}"
        for day_offset in range(365):
            d = today - timedelta(days=day_offset)
            # Base rates influenced by season
            month = d.month
            season_factor = 1.0 + 0.5 * np.sin(2 * np.pi * (month - 3) / 12)

            base_spread = max(0, rng.normal(15 * season_factor, 10))
            base_flame = max(0, rng.normal(4 * season_factor, 3))
            base_spotting = max(0, rng.normal(0.3 * season_factor, 0.2))

            rows.append({
                "circuit_id": cid,
                "event_date": d,
                "spread_rate_ch_hr": round(float(base_spread), 2),
                "flame_length_ft": round(float(base_flame), 2),
                "spotting_distance_mi": round(float(base_spotting), 3),
            })
    return pd.DataFrame(rows)


# ── Feature loading ────────────────────────────────────────────────
def _synthetic_features() -> pd.DataFrame:
    """Generate synthetic features for fire spread prediction."""
    rng = np.random.default_rng(42)
    today = date.today()
    rows = []
    for circuit_num in range(1, 51):
        cid = f"C{circuit_num:03d}"
        for day_offset in range(365):
            d = today - timedelta(days=day_offset)
            month = d.month
            day_of_year = d.timetuple().tm_yday

            rows.append({
                "circuit_id": cid,
                "psa_id": f"PSA_{(circuit_num % 5) + 1}",
                "feature_date": d,
                # Wind
                "wind_speed_mph": float(rng.uniform(5, 60)),
                "wind_gust_mph": float(rng.uniform(10, 85)),
                "wind_dir_deg": int(rng.integers(0, 360)),
                # Fuel moisture
                "fuel_moisture_1h": float(rng.uniform(2, 20)),
                "fuel_moisture_10h": float(rng.uniform(3, 25)),
                "fuel_moisture_100h": float(rng.uniform(5, 30)),
                "fuel_moisture_live_herb": float(rng.uniform(30, 150)),
                "fuel_moisture_live_woody": float(rng.uniform(60, 200)),
                # Terrain
                "slope_pct": float(rng.uniform(0, 60)),
                "aspect_deg": int(rng.integers(0, 360)),
                "elevation_ft": float(rng.uniform(500, 8000)),
                # Fire indices
                "erc_max": float(rng.uniform(20, 100)),
                "bi_max": float(rng.uniform(10, 80)),
                "ffwi_max": float(rng.uniform(1, 50)),
                # Weather
                "max_temp_f": float(rng.uniform(60, 115)),
                "min_rh_pct": float(rng.uniform(4, 40)),
                # Fuel model (Anderson 13 + custom)
                "fuel_model_code": int(rng.choice([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])),
                # Fire proximity
                "active_incidents_50mi": int(rng.integers(0, 8)),
                "acres_burning_50mi": float(rng.uniform(0, 5000)),
                "nearest_fire_dist_mi": float(rng.uniform(0.5, 100)),
                "nearest_fire_frp": float(rng.uniform(0, 500)),
                # Circuit
                "hftd_tier": int(rng.choice([2, 3])),
                "length_miles": float(rng.uniform(5, 80)),
                "voltage_kv": float(rng.choice([12.0, 21.0, 69.0, 115.0])),
                # Seasonality
                "month_sin": np.sin(2 * np.pi * month / 12),
                "month_cos": np.cos(2 * np.pi * month / 12),
                "day_sin": np.sin(2 * np.pi * day_of_year / 365),
                "day_cos": np.cos(2 * np.pi * day_of_year / 365),
            })
    return pd.DataFrame(rows)


def load_features(db, lookback_days: int) -> pd.DataFrame:
    """Load features from database or fall back to synthetic."""
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
        logger.warning("No circuit features — using synthetic for fire spread.")
        return _synthetic_features()

    # Add fire-spread-specific derived features with defaults
    month = pd.to_datetime(df["feature_date"]).dt.month
    day_of_year = pd.to_datetime(df["feature_date"]).dt.dayofyear

    df["wind_speed_mph"] = df.get("max_wind_mph", pd.Series(15.0, index=df.index))
    df["wind_gust_mph"] = df.get("max_gust_mph", pd.Series(25.0, index=df.index))
    df["wind_dir_deg"] = df.get("wind_dir_deg", pd.Series(270, index=df.index)).fillna(270)
    df["fuel_moisture_1h"] = df.get("fuel_moisture_1h", pd.Series(8.0, index=df.index)).fillna(8.0)
    df["fuel_moisture_10h"] = df.get("fuel_moisture_10h", pd.Series(10.0, index=df.index)).fillna(10.0)
    df["fuel_moisture_100h"] = df.get("fuel_moisture_100h", pd.Series(12.0, index=df.index)).fillna(12.0)
    df["fuel_moisture_live_herb"] = df.get("fuel_moisture_live_herb", pd.Series(80.0, index=df.index)).fillna(80.0)
    df["fuel_moisture_live_woody"] = df.get("fuel_moisture_live_woody", pd.Series(100.0, index=df.index)).fillna(100.0)
    df["slope_pct"] = df.get("slope_pct", pd.Series(15.0, index=df.index)).fillna(15.0)
    df["aspect_deg"] = df.get("aspect_deg", pd.Series(180, index=df.index)).fillna(180)
    df["elevation_ft"] = df.get("elevation_ft", pd.Series(2000.0, index=df.index)).fillna(2000.0)
    df["fuel_model_code"] = df.get("fuel_model_code", pd.Series(2, index=df.index)).fillna(2)
    df["nearest_fire_dist_mi"] = df.get("nearest_fire_dist_mi", pd.Series(50.0, index=df.index)).fillna(50.0)
    df["nearest_fire_frp"] = df.get("nearest_fire_frp", pd.Series(0.0, index=df.index)).fillna(0.0)

    df["month_sin"] = np.sin(2 * np.pi * month / 12)
    df["month_cos"] = np.cos(2 * np.pi * month / 12)
    df["day_sin"] = np.sin(2 * np.pi * day_of_year / 365)
    df["day_cos"] = np.cos(2 * np.pi * day_of_year / 365)
    df["feature_date"] = pd.to_datetime(df["feature_date"]).dt.date

    return df


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
            df_labels = _synthetic_labels()  # No real fire behavior labels yet

        # Join features to labels
        df_feat["feature_date_d"] = pd.to_datetime(df_feat["feature_date"]).dt.date
        df_labels["event_date_d"] = pd.to_datetime(df_labels["event_date"]).dt.date
        df = df_feat.merge(
            df_labels,
            left_on=["circuit_id", "feature_date_d"],
            right_on=["circuit_id", "event_date_d"],
            how="left",
        )
        df["spread_rate_ch_hr"] = df["spread_rate_ch_hr"].fillna(0)
        df["flame_length_ft"] = df["flame_length_ft"].fillna(0)
        df["spotting_distance_mi"] = df["spotting_distance_mi"].fillna(0)

        logger.info(
            "Training Model C on %d samples (mean_spread=%.1f ch/hr, mean_flame=%.1f ft)",
            len(df), df["spread_rate_ch_hr"].mean(), df["flame_length_ft"].mean(),
        )

        # Chronological split
        df = df.sort_values("feature_date")
        split_idx = int(len(df) * (1 - eval_split))
        X_train = df.iloc[:split_idx][FEATURE_COLS].fillna(0)
        X_val   = df.iloc[split_idx:][FEATURE_COLS].fillna(0)

        # Train 3 regressors: spread_rate, flame_length, spotting_distance
        targets = {
            "spread_rate_ch_hr": df.iloc[:split_idx]["spread_rate_ch_hr"],
            "flame_length_ft": df.iloc[:split_idx]["flame_length_ft"],
            "spotting_distance_mi": df.iloc[:split_idx]["spotting_distance_mi"],
        }
        val_targets = {
            "spread_rate_ch_hr": df.iloc[split_idx:]["spread_rate_ch_hr"],
            "flame_length_ft": df.iloc[split_idx:]["flame_length_ft"],
            "spotting_distance_mi": df.iloc[split_idx:]["spotting_distance_mi"],
        }

        models = {}
        metrics = {}

        for target_name, y_train in targets.items():
            y_val = val_targets[target_name]

            if USE_LGB:
                model = lgb.LGBMRegressor(
                    n_estimators=400,
                    learning_rate=0.03,
                    max_depth=7,
                    num_leaves=40,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    min_child_samples=15,
                    reg_alpha=0.1,
                    reg_lambda=0.1,
                    random_state=42,
                )
            else:
                model = xgb.XGBRegressor(
                    n_estimators=400,
                    learning_rate=0.03,
                    max_depth=7,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    random_state=42,
                )

            model.fit(X_train, y_train)
            models[target_name] = model

            # Evaluate
            from sklearn.metrics import mean_absolute_error, r2_score
            y_pred = model.predict(X_val)
            mae = mean_absolute_error(y_val, y_pred)
            r2 = r2_score(y_val, y_pred)
            metrics[target_name] = {"mae": round(mae, 4), "r2": round(r2, 4)}
            logger.info("  %s: MAE=%.3f R²=%.3f", target_name, mae, r2)

        # Feature importances from spread rate model (primary)
        fi = dict(zip(FEATURE_COLS, models["spread_rate_ch_hr"].feature_importances_.tolist()))
        top_features = dict(sorted(fi.items(), key=lambda x: -x[1])[:10])

        # Save all three models
        Path(settings.MODEL_DIR).mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(models, f)

        meta = {
            "model_name": "fire_spread",
            "model_version": "v1",
            "trained_at": date.today().isoformat(),
            "algorithm": "LightGBM" if USE_LGB else "XGBoost",
            "n_train": len(X_train),
            "n_val": len(X_val),
            "metrics": metrics,
            "feature_cols": FEATURE_COLS,
            "top_features": top_features,
            "spread_thresholds": SPREAD_THRESHOLDS,
            "flame_thresholds": FLAME_THRESHOLDS,
        }
        with open(META_PATH, "w") as f:
            json.dump(meta, f, indent=2)

        logger.info("✓ Model C saved: %s", MODEL_PATH)
        return {"status": "success", **meta}
    finally:
        db.close()


# ── Inference ──────────────────────────────────────────────────────
def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def predict(features_df: pd.DataFrame, models=None) -> pd.DataFrame:
    """
    Score circuits for fire behavior. Returns df with:
      spread_rate_ch_hr, flame_length_ft, spotting_distance_mi,
      spread_severity, flame_severity, top_drivers
    """
    if models is None:
        models = load_model()

    X = features_df.reindex(columns=FEATURE_COLS).fillna(0)
    result = features_df.copy()

    result["spread_rate_ch_hr"] = np.round(
        np.maximum(0, models["spread_rate_ch_hr"].predict(X)), 2
    )
    result["flame_length_ft"] = np.round(
        np.maximum(0, models["flame_length_ft"].predict(X)), 2
    )
    result["spotting_distance_mi"] = np.round(
        np.maximum(0, models["spotting_distance_mi"].predict(X)), 3
    )

    result["spread_severity"] = [_spread_bucket(r) for r in result["spread_rate_ch_hr"]]
    result["flame_severity"] = [_flame_bucket(f) for f in result["flame_length_ft"]]

    # Top drivers from spread rate model
    importances = models["spread_rate_ch_hr"].feature_importances_
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
    """Score and store fire spread predictions."""
    from features.feature_builder import build_features_for_date
    from sqlalchemy import text as sqlt

    if prediction_date is None:
        prediction_date = date.today()

    db = SessionLocal()
    try:
        models = load_model()
        df = build_features_for_date(prediction_date, db)
        if df.empty:
            return 0

        # Add fire-spread-specific features with defaults
        rng = np.random.default_rng(int(prediction_date.toordinal()))
        for col, default in [
            ("wind_speed_mph", "max_wind_mph"), ("wind_gust_mph", "max_gust_mph"),
        ]:
            if col not in df.columns:
                df[col] = df.get(default, pd.Series(15.0, index=df.index))

        for col, val in [
            ("wind_dir_deg", 270), ("fuel_moisture_1h", 8.0), ("fuel_moisture_10h", 10.0),
            ("fuel_moisture_100h", 12.0), ("fuel_moisture_live_herb", 80.0),
            ("fuel_moisture_live_woody", 100.0), ("slope_pct", 15.0),
            ("aspect_deg", 180), ("elevation_ft", 2000.0), ("fuel_model_code", 2),
            ("nearest_fire_dist_mi", 50.0), ("nearest_fire_frp", 0.0),
        ]:
            if col not in df.columns:
                df[col] = val

        df = predict(df, models)
        rows = []
        for _, row in df.iterrows():
            rows.append({
                "model_name": "fire_spread",
                "model_version": "v1",
                "circuit_id": row.get("circuit_id"),
                "psa_id": row.get("psa_id"),
                "prediction_date": str(prediction_date),
                "horizon_label": "current",
                "prob_score": float(row["spread_rate_ch_hr"]),  # store spread rate as primary score
                "risk_bucket": row["spread_severity"],
                "top_drivers": json.dumps({
                    "spread_rate_ch_hr": float(row["spread_rate_ch_hr"]),
                    "flame_length_ft": float(row["flame_length_ft"]),
                    "spotting_distance_mi": float(row["spotting_distance_mi"]),
                    "flame_severity": row["flame_severity"],
                    "drivers": row.get("top_drivers", {}),
                }),
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
    parser = argparse.ArgumentParser(description="Train Model C: Fire Spread & Behavior")
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
