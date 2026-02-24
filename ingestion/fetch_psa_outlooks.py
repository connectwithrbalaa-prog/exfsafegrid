"""
ingestion/fetch_psa_outlooks.py
================================
Fetches and upserts NIFC Predictive Services outlook data:
  A) 7-Day Significant Fire Potential (Day 1–7 layers)
     https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/outlooks_forecast/MapServer
  B) Monthly / Extended Outlooks (Month 1–4)
     https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/Outlooks_Monthly_Extended/MapServer
Upserts into table: psa_outlook
"""
import json
import logging
import time
from datetime import date, datetime, timezone
from typing import Optional
import requests
from sqlalchemy import text
from sqlalchemy.orm import Session
from config.database import SessionLocal, log_ingestion
from config.settings import settings

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────
OUTLOOK_7DAY_BASE = settings.NIFC_OUTLOOK_7DAY_URL
OUTLOOK_MONTHLY_BASE = settings.NIFC_OUTLOOK_MONTHLY_URL

FIRE_POTENTIAL_MAP = {
    1: "Below Normal",
    2: "Normal",
    3: "Above Normal",
    4: "Critical",
    5: "Extremely Critical",
}

# Field name candidates across different NIFC layer vintages
_PSA_FIELD_CANDIDATES = [
    "PSA_ID", "psa_id", "PSA", "PSAID", "GACCPSAName",
    "Name", "label", "LABEL", "ObjectID",
]
_FP_FIELD_CANDIDATES = [
    "FP_Val", "fp_val", "FirePotential", "fire_potential",
    "Category", "category", "GRIDCODE", "gridcode",
]
_DATE_FIELD_CANDIDATES = [
    "DateCurrent", "date_current", "ValidDate", "valid_date",
    "ForecastDate", "forecast_date",
]


# ── Helpers ───────────────────────────────────────────────────────
def _get(field_candidates: list, attrs: dict):
    for f in field_candidates:
        if f in attrs and attrs[f] is not None:
            return attrs[f]
    return None


def _rings_to_geojson(geom: Optional[dict]) -> Optional[str]:
    if not geom:
        return None
    rings = geom.get("rings", [])
    if not rings:
        return None
    if len(rings) == 1:
        return json.dumps({"type": "Polygon", "coordinates": rings})
    return json.dumps({"type": "MultiPolygon", "coordinates": [[r] for r in rings]})


def _fetch_layer_features(
    base_url: str,
    layer_id: int,
    retries: int = 3,
    delay: float = 4.0,
) -> list:
    """Paginated fetch from a single ArcGIS MapServer layer."""
    url = f"{base_url}/{layer_id}/query"
    all_features = []
    offset = 0
    while True:
        params = {
            "where": "1=1",
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": settings.ARCGIS_MAX_RECORDS,
            "f": "json",
        }
        for attempt in range(1, retries + 1):
            try:
                r = requests.get(url, params=params, timeout=settings.ARCGIS_REQUEST_TIMEOUT)
                r.raise_for_status()
                data = r.json()
                break
            except Exception as exc:
                logger.warning("Layer %d attempt %d/%d: %s", layer_id, attempt, retries, exc)
                if attempt == retries:
                    raise
                time.sleep(delay)
        feats = data.get("features", [])
        all_features.extend(feats)
        if not data.get("exceededTransferLimit", False):
            break
        offset += settings.ARCGIS_MAX_RECORDS
    return all_features


def _get_layers(base_url: str) -> list:
    """List all layers in a MapServer."""
    r = requests.get(base_url, params={"f": "json"}, timeout=settings.ARCGIS_REQUEST_TIMEOUT)
    r.raise_for_status()
    return r.json().get("layers", [])


def _upsert_psa_outlook(db: Session, rows: list) -> tuple[int, int]:
    """Upsert rows into psa_outlook. Returns (inserted, updated)."""
    inserted = updated = 0
    upsert_sql = text("""
        INSERT INTO psa_outlook
            (psa_id, outlook_type, forecast_date, period_label,
             fire_potential, fire_potential_label, raw_json, geometry, retrieved_at)
        VALUES
            (:psa_id, :outlook_type, :forecast_date, :period_label,
             :fire_potential, :fire_potential_label, :raw_json::JSONB,
             CASE WHEN :geometry IS NOT NULL
                  THEN ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326))
                  ELSE NULL END,
             NOW())
        ON CONFLICT (psa_id, outlook_type, forecast_date, period_label)
        DO UPDATE SET
            fire_potential       = EXCLUDED.fire_potential,
            fire_potential_label = EXCLUDED.fire_potential_label,
            raw_json             = EXCLUDED.raw_json,
            geometry             = EXCLUDED.geometry,
            retrieved_at         = NOW()
        RETURNING (xmax = 0) AS was_inserted
    """)
    for row in rows:
        result = db.execute(upsert_sql, row)
        was_ins = result.scalar()
        if was_ins:
            inserted += 1
        else:
            updated += 1
    db.commit()
    return inserted, updated


# ── 7-Day Outlooks ────────────────────────────────────────────────
def fetch_7day_outlooks(db: Optional[Session] = None) -> dict:
    """
    Fetch Day 1–7 layers from the 7-Day Significant Fire Potential Outlooks service.
    Returns ingestion summary dict.
    """
    t0 = time.time()
    own_db = db is None
    if own_db:
        db = SessionLocal()
    total_fetched = total_inserted = total_updated = 0
    today = date.today()
    status = "success"
    error_msg = None
    try:
        # Discover layers
        try:
            layers = _get_layers(OUTLOOK_7DAY_BASE)
        except Exception:
            # Fallback: assume layers 0–6 are Day 1–7
            layers = [{"id": i, "name": f"Day {i + 1}"} for i in range(7)]

        # Filter to day layers (id 0–6 or names containing "Day")
        day_layers = [
            l for l in layers
            if l.get("id", 99) <= 6 or "day" in l.get("name", "").lower()
        ]
        if not day_layers:
            day_layers = [{"id": i, "name": f"Day {i + 1}"} for i in range(7)]

        for layer in day_layers:
            lid = layer["id"]
            day_num = lid + 1
            period_label = f"Day{day_num}"
            try:
                features = _fetch_layer_features(OUTLOOK_7DAY_BASE, lid)
            except Exception as exc:
                logger.error("Failed 7-Day layer id=%d: %s", lid, exc)
                continue
            total_fetched += len(features)
            rows = []
            for feat in features:
                attrs = feat.get("attributes", {})
                geom = feat.get("geometry")
                psa_id = str(_get(_PSA_FIELD_CANDIDATES, attrs) or f"LAYER{lid}_OBJ{attrs.get('OBJECTID','?')}")
                fp_raw = _get(_FP_FIELD_CANDIDATES, attrs)
                fp_val = int(fp_raw) if fp_raw is not None else None
                rows.append({
                    "psa_id": psa_id,
                    "outlook_type": "7day",
                    "forecast_date": str(today),
                    "period_label": period_label,
                    "fire_potential": fp_val,
                    "fire_potential_label": FIRE_POTENTIAL_MAP.get(fp_val),
                    "raw_json": json.dumps(attrs),
                    "geometry": _rings_to_geojson(geom),
                })
            ins, upd = _upsert_psa_outlook(db, rows)
            total_inserted += ins
            total_updated += upd
            logger.info("7-Day %s: fetched=%d ins=%d upd=%d", period_label, len(features), ins, upd)
    except Exception as exc:
        logger.exception("7-Day outlook fetch failed: %s", exc)
        status = "error"
        error_msg = str(exc)
    finally:
        if own_db:
            db.close()
    result = {
        "source": "outlook_7day",
        "records_fetched": total_fetched,
        "records_inserted": total_inserted,
        "records_updated": total_updated,
        "status": status,
        "error_msg": error_msg,
        "duration_sec": round(time.time() - t0, 2),
    }
    log_ingestion(result)
    return result


# ── Monthly / Extended Outlooks ───────────────────────────────────
def fetch_monthly_outlooks(db: Optional[Session] = None) -> dict:
    """
    Fetch Month 1–4 layers from the Monthly/Extended Outlook service.
    Returns ingestion summary dict.
    """
    t0 = time.time()
    own_db = db is None
    if own_db:
        db = SessionLocal()
    total_fetched = total_inserted = total_updated = 0
    today = date.today()
    status = "success"
    error_msg = None
    try:
        try:
            layers = _get_layers(OUTLOOK_MONTHLY_BASE)
        except Exception:
            layers = [{"id": i, "name": f"Month {i + 1}"} for i in range(4)]

        month_layers = [
            l for l in layers
            if l.get("id", 99) <= 3 or "month" in l.get("name", "").lower()
        ]
        if not month_layers:
            month_layers = [{"id": i, "name": f"Month {i + 1}"} for i in range(4)]

        for layer in month_layers:
            lid = layer["id"]
            month_num = lid + 1
            period_label = f"Month{month_num}"

            # Compute the calendar month this represents
            import calendar
            m = today.month + month_num - 1
            y = today.year + (m - 1) // 12
            m = ((m - 1) % 12) + 1
            valid_month_str = f"{y}-{m:02d}"

            try:
                features = _fetch_layer_features(OUTLOOK_MONTHLY_BASE, lid)
            except Exception as exc:
                logger.error("Failed Monthly layer id=%d: %s", lid, exc)
                continue
            total_fetched += len(features)
            rows = []
            for feat in features:
                attrs = feat.get("attributes", {})
                geom = feat.get("geometry")
                psa_id = str(_get(_PSA_FIELD_CANDIDATES, attrs) or f"MLAYER{lid}_OBJ{attrs.get('OBJECTID','?')}")
                fp_raw = _get(_FP_FIELD_CANDIDATES, attrs)
                fp_val = int(fp_raw) if fp_raw is not None else None
                rows.append({
                    "psa_id": psa_id,
                    "outlook_type": "monthly",
                    "forecast_date": str(today),
                    "period_label": period_label,           # Month1, Month2, etc.
                    "fire_potential": fp_val,
                    "fire_potential_label": FIRE_POTENTIAL_MAP.get(fp_val),
                    "raw_json": json.dumps({**attrs, "_valid_month": valid_month_str}),
                    "geometry": _rings_to_geojson(geom),
                })
            ins, upd = _upsert_psa_outlook(db, rows)
            total_inserted += ins
            total_updated += upd
            logger.info("Monthly %s (%s): fetched=%d ins=%d upd=%d",
                        period_label, valid_month_str, len(features), ins, upd)
    except Exception as exc:
        logger.exception("Monthly outlook fetch failed: %s", exc)
        status = "error"
        error_msg = str(exc)
    finally:
        if own_db:
            db.close()
    result = {
        "source": "outlook_monthly",
        "records_fetched": total_fetched,
        "records_inserted": total_inserted,
        "records_updated": total_updated,
        "status": status,
        "error_msg": error_msg,
        "duration_sec": round(time.time() - t0, 2),
    }
    log_ingestion(result)
    return result


# ── Combined runner ───────────────────────────────────────────────
def run(db: Optional[Session] = None, which: str = "both") -> list:
    """
    Main entry: which = '7day' | 'monthly' | 'both'
    Returns list of result dicts.
    """
    results = []
    if which in ("7day", "both"):
        results.append(fetch_7day_outlooks(db))
    if which in ("monthly", "both"):
        results.append(fetch_monthly_outlooks(db))
    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    for r in run():
        print(r)
