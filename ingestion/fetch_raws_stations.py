"""
ingestion/fetch_raws_stations.py
==================================
Fetches Key RAWS (Remote Automated Weather Stations) associated with
NIFC Predictive Services Areas (PSAs).
Source:
  https://fsapps.nwcg.gov/psp/arcgis/rest/services/npsg/PSA_GACC_KeyRAWS/MapServer
Provides: station metadata, current observations, fire weather indices
(Temp, RH, Wind, Precip, ERC, BI, FFWI).
Upserts into table: raws_stations (metadata) and raws_obs (observations).
If a combined table is preferred, upserts into raws_observations.
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

RAWS_BASE_URL = settings.NIFC_RAWS_URL

FIELD_MAP = {
    "station_id": ["StationID", "station_id", "NESSID", "StnID", "OBJECTID"],
    "station_name": ["StationName", "station_name", "Name", "name", "StnName"],
    "psa_id": ["PSA_ID", "psa_id", "PSA", "PSAID", "GACCPSAName"],
    "gacc": ["GACC", "gacc", "GACCName"],
    "elevation_ft": ["Elevation", "elevation", "Elev_ft", "elev"],
    "obs_time": ["ObsDateTime", "obs_date_time", "ObsTime", "DateTime"],
    "temp_f": ["Temp", "temp", "TempF", "temp_f", "Temperature"],
    "rh_pct": ["RH", "rh", "RelHumidity", "rh_pct"],
    "wind_speed_mph": ["WindSpeed", "wind_speed", "WndSpd", "wind_speed_mph"],
    "wind_gust_mph": ["WindGust", "wind_gust", "WndGst", "wind_gust_mph"],
    "wind_dir_deg": ["WindDir", "wind_dir", "WndDir"],
    "precip_in": ["Precip", "precip", "Precipitation", "precip_in"],
    "erc": ["ERC", "erc"],
    "bi": ["BI", "bi", "BurningIndex"],
    "ffwi": ["FFWI", "ffwi", "FosbergFireWeatherIndex"],
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


def _fetch_all_layers(base_url: str) -> list:
    """
    The Key RAWS service may have multiple layers (one per PSA or GACC).
    Discover and fetch all.
    """
    # Get service metadata
    r = requests.get(base_url, params={"f": "json"}, timeout=settings.ARCGIS_REQUEST_TIMEOUT)
    r.raise_for_status()
    service_info = r.json()
    layers = service_info.get("layers", [])
    if not layers:
        # Single-layer service — query layer 0
        layers = [{"id": 0}]

    all_features = []
    for layer in layers:
        lid = layer["id"]
        layer_url = f"{base_url}/{lid}"
        offset = 0
        while True:
            resp = requests.get(
                f"{layer_url}/query",
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
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                logger.warning("RAWS layer %d error: %s", lid, data["error"])
                break
            feats = data.get("features", [])
            all_features.extend(feats)
            if not data.get("exceededTransferLimit", False):
                break
            offset += settings.ARCGIS_MAX_RECORDS
    return all_features


def _upsert_raws(db: Session, rows: list) -> tuple[int, int]:
    """Upsert RAWS observations. Dedup key: (station_id, obs_time)."""
    inserted = updated = 0
    sql = text("""
        INSERT INTO raws_observations
            (station_id, station_name, psa_id, obs_time,
             temp_f, rh_pct, wind_speed_mph, wind_gust_mph, wind_dir_deg,
             precip_in, erc, bi, ffwi, geometry, raw_json, retrieved_at)
        VALUES
            (:station_id, :station_name, :psa_id, :obs_time::TIMESTAMPTZ,
             :temp_f, :rh_pct, :wind_speed_mph, :wind_gust_mph, :wind_dir_deg,
             :precip_in, :erc, :bi, :ffwi,
             CASE WHEN :geometry IS NOT NULL
                  THEN ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326)
                  ELSE NULL END,
             :raw_json::JSONB, NOW())
        ON CONFLICT (station_id, obs_time) DO UPDATE SET
            temp_f         = EXCLUDED.temp_f,
            rh_pct         = EXCLUDED.rh_pct,
            wind_speed_mph = EXCLUDED.wind_speed_mph,
            wind_gust_mph  = EXCLUDED.wind_gust_mph,
            erc            = EXCLUDED.erc,
            bi             = EXCLUDED.bi,
            ffwi           = EXCLUDED.ffwi,
            raw_json       = EXCLUDED.raw_json,
            retrieved_at   = NOW()
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
    Fetch Key RAWS observations from NIFC PSA/GACC service.
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
        features = _fetch_all_layers(RAWS_BASE_URL)
        fetched = len(features)
        logger.info("RAWS: fetched %d features", fetched)
        now_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        rows = []
        for feat in features:
            attrs = feat.get("attributes", {})
            geom = feat.get("geometry", {})
            station_id = str(_pick(attrs, FIELD_MAP["station_id"]) or "")
            if not station_id:
                continue
            obs_epoch = _pick(attrs, FIELD_MAP["obs_time"])
            obs_time = _epoch_to_iso(obs_epoch) or now_iso
            x = geom.get("x") if geom else None
            y = geom.get("y") if geom else None
            rows.append({
                "station_id": station_id,
                "station_name": _pick(attrs, FIELD_MAP["station_name"]) or "",
                "psa_id": str(_pick(attrs, FIELD_MAP["psa_id"]) or ""),
                "obs_time": obs_time,
                "temp_f": _pick(attrs, FIELD_MAP["temp_f"]),
                "rh_pct": _pick(attrs, FIELD_MAP["rh_pct"]),
                "wind_speed_mph": _pick(attrs, FIELD_MAP["wind_speed_mph"]),
                "wind_gust_mph": _pick(attrs, FIELD_MAP["wind_gust_mph"]),
                "wind_dir_deg": _pick(attrs, FIELD_MAP["wind_dir_deg"]),
                "precip_in": _pick(attrs, FIELD_MAP["precip_in"]),
                "erc": _pick(attrs, FIELD_MAP["erc"]),
                "bi": _pick(attrs, FIELD_MAP["bi"]),
                "ffwi": _pick(attrs, FIELD_MAP["ffwi"]),
                "geometry": (
                    json.dumps({"type": "Point", "coordinates": [x, y]})
                    if x is not None and y is not None else None
                ),
                "raw_json": json.dumps(attrs),
            })
        if rows:
            inserted, updated = _upsert_raws(db, rows)
        logger.info("RAWS: rows=%d ins=%d upd=%d", len(rows), inserted, updated)
    except Exception as exc:
        logger.exception("RAWS fetch failed: %s", exc)
        db.rollback()
        status = "error"
        error_msg = str(exc)
    finally:
        if own_db:
            db.close()
    result = {
        "source": "raws_stations",
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
