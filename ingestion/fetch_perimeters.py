"""
ingestion/fetch_perimeters.py
==============================
Fetches near-real-time NIFC Wildfire Perimeters (~every 5 min during events).
Primary endpoints (tried in order):
  1. WFIGS Interagency Perimeters Current (most up-to-date)
  2. NIFC GeoMAC / WFIGS All Perimeters (broader history)
Upserts into table: perimeters
Deduplication key: (incident_id, date_current) — prevents duplicate snapshots.
"""
import json
import logging
import time
from datetime import datetime
from typing import Optional
import requests
from sqlalchemy import text
from sqlalchemy.orm import Session
from config.database import SessionLocal, log_ingestion
from config.settings import settings

logger = logging.getLogger(__name__)

# Endpoint priority list
PERIMETER_ENDPOINTS = [
    # Current perimeters — updates ~5 min during active events
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Interagency_Perimeters_Current/FeatureServer/0",
    # All active perimeters — slightly broader
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Interagency_Perimeters/FeatureServer/0",
]

# Canonical field → raw name candidates
FIELD_MAP = {
    "perimeter_id": ["PerimeterID", "perimeterID", "OBJECTID", "GlobalID"],
    "incident_id": ["IrwinID", "irwinID", "IncidentID", "incident_id", "UniqueFireIdentifier"],
    "incident_name": ["IncidentName", "incidentName", "poly_IncidentName", "Name"],
    "gis_acres": ["GISAcres", "gisAcres", "poly_GISAcres", "GIS_Acres", "Acres"],
    "map_acres": ["MapAcres", "mapAcres", "poly_MapAcres"],
    "date_current": ["DateCurrent", "dateCurrent", "poly_DateCurrent", "ModifiedOnDateTime"],
    "containment_pct": ["PercentContained", "percentContained", "poly_PercentContained"],
    "state": ["POOState", "State", "state"],
}


def _pick(attrs: dict, candidates: list):
    for f in candidates:
        if f in attrs and attrs[f] is not None:
            return attrs[f]
    return None


def _epoch_to_iso(epoch_ms) -> Optional[str]:
    if epoch_ms is None:
        return None
    try:
        return datetime.utcfromtimestamp(int(epoch_ms) / 1000).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None


def _geom_to_geojson(geom: Optional[dict]) -> Optional[str]:
    """Convert ArcGIS polygon/multipolygon geometry to GeoJSON string."""
    if not geom:
        return None
    rings = geom.get("rings", [])
    if not rings:
        return None
    if len(rings) == 1:
        return json.dumps({"type": "Polygon", "coordinates": rings})
    return json.dumps({"type": "MultiPolygon", "coordinates": [[r] for r in rings]})


def _fetch_all(endpoint: str) -> list:
    """Paginated fetch from ArcGIS FeatureServer."""
    all_features = []
    offset = 0
    while True:
        r = requests.get(
            f"{endpoint}/query",
            params={
                "where": "1=1",
                "outFields": "*",
                "returnGeometry": "true",
                "outSR": "4326",
                "resultOffset": offset,
                "resultRecordCount": settings.ARCGIS_MAX_RECORDS,
                "f": "json",
            },
            timeout=settings.ARCGIS_REQUEST_TIMEOUT,
        )
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            raise RuntimeError(f"ArcGIS error: {data['error']}")
        feats = data.get("features", [])
        all_features.extend(feats)
        if not data.get("exceededTransferLimit", False):
            break
        offset += settings.ARCGIS_MAX_RECORDS
    return all_features


def _upsert_perimeters(db: Session, rows: list) -> tuple[int, int]:
    """Idempotent upsert on (incident_id, date_current)."""
    inserted = updated = 0
    sql = text("""
        INSERT INTO perimeters
            (perimeter_id, incident_id, incident_name, state,
             gis_acres, map_acres, containment_pct, date_current,
             geometry, raw_json, retrieved_at)
        VALUES
            (:perimeter_id, :incident_id, :incident_name, :state,
             :gis_acres, :map_acres, :containment_pct, CAST(:date_current AS TIMESTAMPTZ),
             CASE WHEN :geometry IS NOT NULL
                  THEN ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326))
                  ELSE NULL END,
             CAST(:raw_json AS JSONB), NOW())
        ON CONFLICT (incident_id, date_current) DO UPDATE SET
            gis_acres       = EXCLUDED.gis_acres,
            map_acres       = EXCLUDED.map_acres,
            containment_pct = EXCLUDED.containment_pct,
            geometry        = EXCLUDED.geometry,
            raw_json        = EXCLUDED.raw_json,
            retrieved_at    = NOW()
        RETURNING (xmax = 0) AS was_inserted
    """)
    for row in rows:
        result = db.execute(sql, row)
        if result.scalar():
            inserted += 1
        else:
            updated += 1
    db.commit()
    return inserted, updated


def run(db: Optional[Session] = None) -> dict:
    """
    Fetch current wildfire perimeters and upsert into `perimeters`.
    Returns summary dict. Designed to be called every 15–30 minutes.
    """
    t0 = time.time()
    own_db = db is None
    if own_db:
        db = SessionLocal()
    fetched = inserted = updated = 0
    status = "success"
    error_msg = None
    try:
        features = None
        last_exc = None
        for endpoint in PERIMETER_ENDPOINTS:
            try:
                features = _fetch_all(endpoint)
                logger.info("Perimeters: fetched %d from %s", len(features), endpoint)
                break
            except Exception as exc:
                logger.warning("Perimeter endpoint %s failed: %s", endpoint, exc)
                last_exc = exc
        if features is None:
            raise last_exc or RuntimeError("All perimeter endpoints failed")
        fetched = len(features)
        rows = []
        skipped = 0
        for feat in features:
            attrs = feat.get("attributes", {})
            geom = feat.get("geometry")
            incident_id = str(_pick(attrs, FIELD_MAP["incident_id"]) or "")
            date_current_raw = _pick(attrs, FIELD_MAP["date_current"])
            date_current = _epoch_to_iso(date_current_raw)
            # Skip features without a timestamp — can't deduplicate them safely
            if not date_current:
                # Use ingestion time as fallback
                date_current = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            if not incident_id:
                skipped += 1
                continue
            gis_acres = _pick(attrs, FIELD_MAP["gis_acres"])
            map_acres = _pick(attrs, FIELD_MAP["map_acres"])
            rows.append({
                "perimeter_id": str(_pick(attrs, FIELD_MAP["perimeter_id"]) or ""),
                "incident_id": incident_id,
                "incident_name": _pick(attrs, FIELD_MAP["incident_name"]) or "",
                "state": _pick(attrs, FIELD_MAP["state"]) or "",
                "gis_acres": gis_acres,
                "map_acres": map_acres,
                "containment_pct": _pick(attrs, FIELD_MAP["containment_pct"]),
                "date_current": date_current,
                "geometry": _geom_to_geojson(geom),
                "raw_json": json.dumps(attrs),
            })
        if rows:
            inserted, updated = _upsert_perimeters(db, rows)
        logger.info(
            "Perimeters: fetched=%d rows=%d ins=%d upd=%d skipped=%d",
            fetched, len(rows), inserted, updated, skipped,
        )
    except Exception as exc:
        logger.exception("Perimeter fetch failed: %s", exc)
        db.rollback()
        status = "error"
        error_msg = str(exc)
    finally:
        if own_db:
            db.close()
    result = {
        "source": "perimeters",
        "records_fetched": fetched,
        "records_inserted": inserted,
        "records_updated": updated,
        "status": status,
        "error_msg": error_msg,
        "duration_sec": round(time.time() - t0, 2),
    }
    log_ingestion(result)
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    print(run())
