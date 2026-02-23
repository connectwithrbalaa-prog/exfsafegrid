"""
ingestion/fetch_active_incidents.py
=====================================
Fetches NIFC WFIGS active wildfire incidents (IMSR feed).
Primary endpoint (WFIGS FeatureServer — most reliable):
  https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/
  WFIGS_Incident_Locations_Current/FeatureServer/0
Also attempts the NIFC IMSR MapServer if primary fails.
Upserts into table: incidents
"""
import json
import logging
import time
from datetime import datetime
from typing import Optional
import requests
from sqlalchemy import text
from sqlalchemy.orm import Session
from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

# Ordered list of endpoint candidates — tries each in sequence
INCIDENT_ENDPOINTS = [
    # WFIGS Current — primary
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Incident_Locations_Current/FeatureServer/0",
    # WFIGS All Incidents — fallback
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Interagency_FirePerimeters/FeatureServer/0",
]

# Field name normalization map: canonical → list of possible raw names
FIELD_MAP = {
    "incident_id": ["IrwinID", "irwinID", "IncidentID", "incident_id", "OBJECTID"],
    "incident_name": ["IncidentName", "incidentName", "Name", "name", "INCIDENT_NAME"],
    "state": ["POOState", "pooState", "State", "state", "POO_State"],
    "cause": ["FireCause", "fireCause", "Cause", "cause"],
    "acres_burned": ["DailyAcres", "dailyAcres", "CalculatedAcres", "GISAcres", "Acres"],
    "containment_pct": ["PercentContained", "percentContained", "containmentPercent"],
    "discovery_epoch": ["FireDiscoveryDateTime", "fireDiscoveryDateTime", "DiscoveryDate"],
    "last_update_epoch": ["ModifiedOnDateTime", "modifiedOnDateTime", "DateCurrent", "EditedDate"],
    "is_active": ["IsActive", "isActive", "Active"],
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


def _fetch_all(endpoint: str, active_only: bool = True) -> list:
    """Paginate through all features from a FeatureServer endpoint."""
    where = "1=1"
    if active_only:
        # Most WFIGS layers support this filter
        where = "IsActive='Y' OR IsActive=1 OR IsActive IS NULL"
    all_features = []
    offset = 0
    while True:
        params = {
            "where": where,
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": settings.ARCGIS_MAX_RECORDS,
            "f": "json",
        }
        r = requests.get(
            f"{endpoint}/query",
            params=params,
            timeout=settings.ARCGIS_REQUEST_TIMEOUT,
        )
        r.raise_for_status()
        data = r.json()
        # WFIGS returns error dict if query syntax unsupported
        if "error" in data:
            # Retry without active filter
            if where != "1=1":
                return _fetch_all(endpoint, active_only=False)
            raise RuntimeError(f"ArcGIS error: {data['error']}")
        feats = data.get("features", [])
        all_features.extend(feats)
        if not data.get("exceededTransferLimit", False):
            break
        offset += settings.ARCGIS_MAX_RECORDS
    return all_features


def _upsert_incidents(db: Session, rows: list) -> tuple[int, int]:
    inserted = updated = 0
    sql = text("""
        INSERT INTO incidents
            (incident_id, incident_name, state, cause,
             discovery_date, last_update, is_active,
             acres_burned, containment_pct,
             latitude, longitude, geometry, raw_json, retrieved_at)
        VALUES
            (:incident_id, :incident_name, :state, :cause,
             :discovery_date::TIMESTAMPTZ, :last_update::TIMESTAMPTZ, :is_active,
             :acres_burned, :containment_pct,
             :latitude, :longitude,
             CASE WHEN :geometry IS NOT NULL
                  THEN ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326)
                  ELSE NULL END,
             :raw_json::JSONB, NOW())
        ON CONFLICT (incident_id) DO UPDATE SET
            incident_name   = EXCLUDED.incident_name,
            acres_burned    = EXCLUDED.acres_burned,
            containment_pct = EXCLUDED.containment_pct,
            is_active       = EXCLUDED.is_active,
            last_update     = EXCLUDED.last_update,
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
    Fetch active incidents from NIFC WFIGS and upsert into `incidents`.
    Returns summary dict.
    """
    t0 = time.time()
    own_db = db is None
    if own_db:
        db = SessionLocal()
    fetched = inserted = updated = 0
    status = "success"
    error_msg = None
    try:
        # Try endpoints in order
        features = None
        last_exc = None
        for endpoint in INCIDENT_ENDPOINTS:
            try:
                features = _fetch_all(endpoint)
                logger.info("Incidents: fetched %d from %s", len(features), endpoint)
                break
            except Exception as exc:
                logger.warning("Endpoint %s failed: %s", endpoint, exc)
                last_exc = exc
        if features is None:
            raise last_exc or RuntimeError("All incident endpoints failed")
        fetched = len(features)
        rows = []
        for feat in features:
            attrs = feat.get("attributes", {})
            geom = feat.get("geometry", {})
            incident_id = str(_pick(attrs, FIELD_MAP["incident_id"]) or "")
            if not incident_id:
                continue
            x = geom.get("x") if geom else None
            y = geom.get("y") if geom else None
            # Determine active status — various representations
            is_active_raw = _pick(attrs, FIELD_MAP["is_active"])
            if is_active_raw is None:
                is_active = True  # assume active if no field
            elif isinstance(is_active_raw, bool):
                is_active = is_active_raw
            elif isinstance(is_active_raw, (int, float)):
                is_active = bool(is_active_raw)
            else:
                is_active = str(is_active_raw).upper() in ("Y", "YES", "TRUE", "1", "ACTIVE")
            rows.append({
                "incident_id": incident_id,
                "incident_name": _pick(attrs, FIELD_MAP["incident_name"]) or "",
                "state": _pick(attrs, FIELD_MAP["state"]) or "",
                "cause": _pick(attrs, FIELD_MAP["cause"]) or "",
                "discovery_date": _epoch_to_iso(_pick(attrs, FIELD_MAP["discovery_epoch"])),
                "last_update": _epoch_to_iso(_pick(attrs, FIELD_MAP["last_update_epoch"])),
                "is_active": is_active,
                "acres_burned": _pick(attrs, FIELD_MAP["acres_burned"]),
                "containment_pct": _pick(attrs, FIELD_MAP["containment_pct"]),
                "latitude": y,
                "longitude": x,
                "geometry": (
                    json.dumps({"type": "Point", "coordinates": [x, y]})
                    if x is not None and y is not None else None
                ),
                "raw_json": json.dumps(attrs),
            })
        if rows:
            inserted, updated = _upsert_incidents(db, rows)
        logger.info("Incidents: fetched=%d ins=%d upd=%d", fetched, inserted, updated)
    except Exception as exc:
        logger.exception("Incident fetch failed: %s", exc)
        db.rollback()
        status = "error"
        error_msg = str(exc)
    finally:
        if own_db:
            db.close()
    return {
        "source": "incidents",
        "records_fetched": fetched,
        "records_inserted": inserted,
        "records_updated": updated,
        "status": status,
        "error_msg": error_msg,
        "duration_sec": round(time.time() - t0, 2),
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    print(run())
