"""
api/main.py — ExfSafeGrid Wildfire Ops & PSPS FastAPI Application v2
"""
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import date
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, Query, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from config.database import get_db
from config.settings import settings
from ingestion.scheduler import build_scheduler

logger = logging.getLogger(__name__)
scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    scheduler = build_scheduler()
    scheduler.start()
    logger.info("Ingestion scheduler started")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="ExfSafeGrid Wildfire Ops & PSPS API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def auth(key: str = Security(_key_header)):
    if settings.API_KEY and key != settings.API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return key


class TrainRequest(BaseModel):
    model: str = "both"
    synthetic: bool = False


class ScoreRequest(BaseModel):
    prediction_date: Optional[date] = None
    model: str = "both"


class BriefingRequest(BaseModel):
    date: Optional[date] = None
    overwrite: bool = False


class WatchlistRequest(BaseModel):
    date: Optional[date] = None
    horizon: str = "24h"
    overwrite: bool = False


class SimulateRequest(BaseModel):
    scenario_name: str
    circuit_ids: List[str]
    horizon_hours: int = 24


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "exf-wildfire-ops-psps", "version": "2.0.0"}


@app.get("/psa-risk", tags=["Predictions"])
def get_psa_risk(
    psa_id: Optional[str] = Query(None),
    month_offset: int = Query(1, ge=1, le=3),
    min_prob: float = Query(0.0, ge=0, le=1),
    prediction_date: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db), _: str = Depends(auth),
):
    """Model A: PSA/Circuit wildfire activity risk (1-3 month). Returns prob_above_normal, risk_bucket, drivers."""
    d = prediction_date or date.today()
    horizon = f"Month{month_offset}"
    params = {"d": str(d), "horizon": horizon, "min_prob": min_prob, "limit": limit}
    extra = ""
    if psa_id:
        extra += " AND mp.psa_id = :psa_id"
        params["psa_id"] = psa_id
    rows = db.execute(text(f"""
        SELECT mp.circuit_id, mp.psa_id, mp.prob_score AS prob_above_normal,
               mp.risk_bucket, mp.top_drivers AS drivers,
               uc.hftd_tier, uc.customer_count, uc.county, uc.voltage_kv
        FROM model_predictions mp
        LEFT JOIN utility_circuits uc ON uc.circuit_id = mp.circuit_id
        WHERE mp.model_name = 'psa_risk'
          AND mp.prediction_date = :d AND mp.horizon_label = :horizon
          AND mp.prob_score >= :min_prob {extra}
        ORDER BY mp.prob_score DESC LIMIT :limit
    """), params).fetchall()
    return {"prediction_date": str(d), "horizon": horizon, "model": "psa_risk",
            "count": len(rows), "results": [dict(r._mapping) for r in rows]}


@app.get("/circuit-ignition-risk", tags=["Predictions"])
def get_circuit_ignition_risk(
    circuit_id: Optional[str] = Query(None),
    horizon_hours: int = Query(24),
    psa_id: Optional[str] = Query(None),
    min_prob: float = Query(0.0, ge=0, le=1),
    risk_band: Optional[str] = Query(None),
    prediction_date: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db), _: str = Depends(auth),
):
    """Model B: Circuit ignition spike risk (24/48/72h). Returns prob_spike, risk_band, drivers."""
    if horizon_hours not in (24, 48, 72):
        raise HTTPException(400, "horizon_hours must be 24, 48, or 72")
    d = prediction_date or date.today()
    horizon = f"{horizon_hours}h"
    params = {"d": str(d), "horizon": horizon, "min_prob": min_prob, "limit": limit}
    extra = ""
    if circuit_id:
        extra += " AND mp.circuit_id = :circuit_id"; params["circuit_id"] = circuit_id
    if psa_id:
        extra += " AND mp.psa_id = :psa_id"; params["psa_id"] = psa_id
    if risk_band:
        extra += " AND mp.risk_bucket = :risk_band"; params["risk_band"] = risk_band.upper()
    rows = db.execute(text(f"""
        SELECT mp.circuit_id, mp.psa_id, mp.prob_score AS prob_spike,
               mp.risk_bucket AS risk_band, mp.top_drivers AS drivers,
               uc.hftd_tier, uc.customer_count, uc.critical_customers, uc.county
        FROM model_predictions mp
        LEFT JOIN utility_circuits uc ON uc.circuit_id = mp.circuit_id
        WHERE mp.model_name = 'ignition_spike'
          AND mp.prediction_date = :d AND mp.horizon_label = :horizon
          AND mp.prob_score >= :min_prob {extra}
        ORDER BY mp.prob_score DESC LIMIT :limit
    """), params).fetchall()
    return {"prediction_date": str(d), "horizon_hours": horizon_hours, "model": "ignition_spike",
            "count": len(rows), "results": [dict(r._mapping) for r in rows]}


@app.get("/briefing", tags=["Agents"])
def get_briefing(briefing_date: Optional[date] = Query(None),
                 db: Session = Depends(get_db), _: str = Depends(auth)):
    d = briefing_date or date.today()
    row = db.execute(text("SELECT * FROM daily_briefings WHERE briefing_date <= :d ORDER BY briefing_date DESC LIMIT 1"),
                     {"d": str(d)}).fetchone()
    if not row: raise HTTPException(404, "No briefing. POST /briefing/generate to create one.")
    return dict(row._mapping)


@app.get("/briefing/html", tags=["Agents"], response_class=HTMLResponse)
def get_briefing_html(briefing_date: Optional[date] = Query(None),
                      db: Session = Depends(get_db), _: str = Depends(auth)):
    """Return the daily briefing as a formatted HTML document."""
    import markdown as md_lib
    d = briefing_date or date.today()
    row = db.execute(text("SELECT * FROM daily_briefings WHERE briefing_date <= :d ORDER BY briefing_date DESC LIMIT 1"),
                     {"d": str(d)}).fetchone()
    if not row:
        raise HTTPException(404, "No briefing. POST /briefing/generate to create one.")
    data = dict(row._mapping)
    body_html = md_lib.markdown(data["markdown_text"], extensions=["tables", "nl2br"])
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ExfSafeGrid Daily Briefing — {data['briefing_date']}</title>
  <style>
    body {{ font-family: Georgia, 'Times New Roman', serif; max-width: 860px; margin: 40px auto;
            padding: 0 24px; color: #1a1a1a; line-height: 1.7; background: #fafaf8; }}
    h1 {{ font-size: 1.7rem; border-bottom: 3px solid #b91c1c; padding-bottom: 10px; color: #111; }}
    h2 {{ font-size: 1.2rem; margin-top: 2rem; color: #1e3a5f; border-left: 4px solid #b91c1c;
          padding-left: 10px; }}
    ul {{ padding-left: 1.4rem; }} li {{ margin-bottom: 0.4rem; }}
    ol {{ padding-left: 1.4rem; }} ol li {{ margin-bottom: 0.6rem; }}
    strong {{ color: #111; }}
    hr {{ border: none; border-top: 1px solid #ccc; margin: 2rem 0; }}
    em {{ color: #555; font-size: 0.9rem; }}
    p {{ margin: 0.6rem 0; }}
    .meta {{ font-size: 0.8rem; color: #888; margin-bottom: 2rem; }}
  </style>
</head>
<body>
  <div class="meta">Generated {data['created_at']} &nbsp;·&nbsp; Model: {data['model_used']} &nbsp;·&nbsp; Tokens: {data['tokens_used']}</div>
  {body_html}
</body>
</html>"""
    return HTMLResponse(content=html)


@app.post("/briefing/generate", tags=["Agents"])
def generate_briefing(req: BriefingRequest, _: str = Depends(auth)):
    from agents.ops_briefing_agent import run
    result = run(briefing_date=req.date, overwrite=req.overwrite)
    if result.get("status") == "error": raise HTTPException(500, result["error"])
    return result


@app.get("/psps-watchlist", tags=["Agents"])
def get_psps_watchlist(watchlist_date: Optional[date] = Query(None),
                       horizon: str = Query("24h"),
                       db: Session = Depends(get_db), _: str = Depends(auth)):
    d = watchlist_date or date.today()
    if horizon not in ("24h", "48h", "72h"): raise HTTPException(400, "horizon must be 24h|48h|72h")
    row = db.execute(text("SELECT * FROM psps_watchlists WHERE watchlist_date <= :d AND horizon = :h ORDER BY watchlist_date DESC LIMIT 1"),
                     {"d": str(d), "h": horizon}).fetchone()
    if not row: raise HTTPException(404, "No watchlist. POST /psps-watchlist/generate to create one.")
    return dict(row._mapping)


@app.post("/psps-watchlist/generate", tags=["Agents"])
def generate_psps_watchlist(req: WatchlistRequest, _: str = Depends(auth)):
    from agents.psps_planning_agent import run
    result = run(watchlist_date=req.date, horizon=req.horizon, overwrite=req.overwrite)
    if result.get("status") == "error": raise HTTPException(500, result["error"])
    return result


@app.get("/incidents/active", tags=["Live Data"])
def get_active_incidents(state: Optional[str] = Query(None), psa_id: Optional[str] = Query(None),
                          min_acres: float = Query(0), limit: int = Query(50, le=200),
                          db: Session = Depends(get_db), _: str = Depends(auth)):
    params = {"min_acres": min_acres, "limit": limit}
    extra = ""
    if state: extra += " AND state = :state"; params["state"] = state.upper()
    if psa_id: extra += " AND psa_id = :psa_id"; params["psa_id"] = psa_id
    rows = db.execute(text(f"""
        SELECT incident_id, incident_name, state, psa_id, cause, discovery_date,
               acres_burned, containment_pct, latitude, longitude, retrieved_at
        FROM incidents WHERE is_active = TRUE AND COALESCE(acres_burned,0) >= :min_acres {extra}
        ORDER BY acres_burned DESC NULLS LAST LIMIT :limit
    """), params).fetchall()
    return {"count": len(rows), "incidents": [dict(r._mapping) for r in rows]}


@app.get("/perimeters/current", tags=["Live Data"])
def get_current_perimeters(incident_id: Optional[str] = Query(None), min_acres: float = Query(0),
                            limit: int = Query(50, le=200),
                            db: Session = Depends(get_db), _: str = Depends(auth)):
    params = {"min_acres": min_acres, "limit": limit}
    extra = ""
    if incident_id: extra += " AND incident_id = :incident_id"; params["incident_id"] = incident_id
    rows = db.execute(text(f"""
        SELECT DISTINCT ON (incident_id)
            perimeter_id, incident_id, incident_name, state,
            gis_acres, map_acres, containment_pct, date_current, retrieved_at
        FROM perimeters WHERE COALESCE(gis_acres, map_acres, 0) >= :min_acres {extra}
        ORDER BY incident_id, date_current DESC LIMIT :limit
    """), params).fetchall()
    return {"count": len(rows), "perimeters": [dict(r._mapping) for r in rows]}


@app.get("/outlooks/7day", tags=["Live Data"])
def get_7day_outlooks(forecast_date: Optional[date] = Query(None),
                       period_label: str = Query("Day1"), psa_id: Optional[str] = Query(None),
                       min_potential: int = Query(1, ge=1, le=5),
                       db: Session = Depends(get_db), _: str = Depends(auth)):
    d = forecast_date or date.today()
    params = {"d": str(d), "period": period_label, "min_pot": min_potential}
    extra = ""
    if psa_id: extra += " AND psa_id = :psa_id"; params["psa_id"] = psa_id
    rows = db.execute(text(f"""
        SELECT psa_id, period_label, forecast_date, fire_potential, fire_potential_label, retrieved_at
        FROM psa_outlook WHERE outlook_type = '7day' AND forecast_date = :d
          AND period_label = :period AND fire_potential >= :min_pot {extra}
        ORDER BY fire_potential DESC
    """), params).fetchall()
    return {"forecast_date": str(d), "period_label": period_label,
            "count": len(rows), "outlooks": [dict(r._mapping) for r in rows]}


@app.get("/outlooks/monthly", tags=["Live Data"])
def get_monthly_outlooks(forecast_date: Optional[date] = Query(None),
                          period_label: str = Query("Month1"),
                          min_potential: int = Query(1, ge=1, le=5),
                          db: Session = Depends(get_db), _: str = Depends(auth)):
    d = forecast_date or date.today()
    rows = db.execute(text("""
        SELECT psa_id, period_label, forecast_date, fire_potential, fire_potential_label, retrieved_at
        FROM psa_outlook WHERE outlook_type = 'monthly' AND forecast_date = :d
          AND period_label = :period AND fire_potential >= :min_pot
        ORDER BY fire_potential DESC
    """), {"d": str(d), "period": period_label, "min_pot": min_potential}).fetchall()
    return {"forecast_date": str(d), "period_label": period_label,
            "count": len(rows), "outlooks": [dict(r._mapping) for r in rows]}


# ── Agent: 12-Hour Circuit Risk Trend ─────────────────────────────────────
@app.get("/agent/risk-12h", tags=["Agent"])
def get_circuit_risk_trend(
    circuit_id: str = Query(..., description="e.g. CIRCUIT_101"),
    db: Session = Depends(get_db), _: str = Depends(auth),
):
    """
    Returns the last 12 hourly ignition-risk predictions for a circuit,
    plus a trend label (RISING / FALLING / STABLE).
    Reads from `model_predictions` where model_name = 'ignition_spike'
    and horizon_label = '24h', ordered by prediction timestamp descending,
    taking the 12 most recent hourly scores.
    """
    rows = db.execute(text("""
        SELECT mp.prediction_date, mp.created_at, mp.prob_score
        FROM model_predictions mp
        WHERE mp.circuit_id = :cid
          AND mp.model_name  = 'ignition_spike'
          AND mp.horizon_label = '24h'
        ORDER BY mp.created_at DESC
        LIMIT 12
    """), {"cid": circuit_id}).fetchall()
    if not rows:
        raise HTTPException(404, f"No predictions for circuit {circuit_id}")
    # Build hourly array (oldest → newest)
    hourly = [
        {"time": r._mapping["created_at"].isoformat(), "prob": round(float(r._mapping["prob_score"]), 4)}
        for r in reversed(rows)
    ]
    # Compute trend: compare average of first 3 vs last 3 points
    if len(hourly) >= 6:
        first3 = sum(h["prob"] for h in hourly[:3]) / 3
        last3  = sum(h["prob"] for h in hourly[-3:]) / 3
        diff = last3 - first3
        trend = "RISING" if diff > 0.03 else ("FALLING" if diff < -0.03 else "STABLE")
    else:
        trend = "STABLE"
    return {
        "circuit_id": circuit_id,
        "trend_label": trend,
        "hourly": hourly,
    }


# ── Agent: Nearby Sensors ─────────────────────────────────────────────────
@app.get("/agent/nearby-sensors", tags=["Agent"])
def get_nearby_sensors(
    lat: float = Query(..., description="Latitude of the circuit/substation"),
    lon: float = Query(..., description="Longitude of the circuit/substation"),
    radius_miles: float = Query(25, ge=1, le=100),
    summary: bool = Query(False, description="Include AI-generated risk summary"),
    circuit_id: Optional[str] = Query(None),
    db: Session = Depends(get_db), _: str = Depends(auth),
):
    """
    Returns RAWS weather stations within `radius_miles` of (lat, lon),
    sorted by distance. Optionally includes a one-paragraph AI summary.
    Extracts lat/lon from the PostGIS geometry column; uses Haversine for
    distance filtering.
    """
    radius_km = radius_miles * 1.60934
    # Wrap in subquery so the computed distance alias can be filtered in WHERE
    # (HAVING without GROUP BY is not valid in PostgreSQL).
    # lat/lon are extracted from the stored PostGIS geometry point.
    rows = db.execute(text("""
        SELECT station_id, station_name, latitude, longitude,
               obs_time, temp_f, rh_pct,
               wind_speed_mph, wind_gust_mph, wind_dir_deg,
               erc, bi, ffwi, precip_in, distance_km
        FROM (
            SELECT rs.station_id,
                   rs.station_name,
                   ST_Y(rs.geometry::geometry) AS latitude,
                   ST_X(rs.geometry::geometry) AS longitude,
                   rs.obs_time, rs.temp_f, rs.rh_pct,
                   rs.wind_speed_mph, rs.wind_gust_mph, rs.wind_dir_deg,
                   rs.erc, rs.bi, rs.ffwi, rs.precip_in,
                   (6371 * acos(LEAST(1.0,
                       cos(radians(:lat)) * cos(radians(ST_Y(rs.geometry::geometry))) *
                       cos(radians(ST_X(rs.geometry::geometry)) - radians(:lon)) +
                       sin(radians(:lat)) * sin(radians(ST_Y(rs.geometry::geometry)))
                   ))) AS distance_km
            FROM raws_observations rs
            WHERE rs.geometry IS NOT NULL
              AND rs.obs_time = (
                  SELECT MAX(obs_time)
                  FROM raws_observations
                  WHERE station_id = rs.station_id
              )
        ) sub
        WHERE distance_km <= :radius_km
        ORDER BY distance_km
        LIMIT 10
    """), {"lat": lat, "lon": lon, "radius_km": radius_km}).fetchall()

    stations = []
    for r in rows:
        m = r._mapping
        stations.append({
            "station_id":     m["station_id"],
            "station_name":   m["station_name"],
            "distance_miles": round(float(m["distance_km"]) * 0.621371, 1),
            "obs_time":       m["obs_time"].isoformat() if m["obs_time"] else None,
            "temp_f":         m["temp_f"],
            "rh_pct":         m["rh_pct"],
            "wind_speed_mph": m["wind_speed_mph"],
            "wind_gust_mph":  m["wind_gust_mph"],
            "wind_dir_deg":   m["wind_dir_deg"],
            "erc":            m["erc"],
            "bi":             m["bi"],
            "ffwi":           m["ffwi"],
            "precip_in":      m["precip_in"],
        })

    # Optional rules-based summary (no extra API call needed)
    summary_text = ""
    if summary and stations:
        nearest = stations[0]
        conditions = []
        if nearest.get("rh_pct") is not None and nearest["rh_pct"] < 15:
            conditions.append(f"critically low humidity ({nearest['rh_pct']}%)")
        elif nearest.get("rh_pct") is not None and nearest["rh_pct"] < 25:
            conditions.append(f"low humidity ({nearest['rh_pct']}%)")
        if nearest.get("wind_gust_mph") is not None and nearest["wind_gust_mph"] > 25:
            conditions.append(f"strong gusts ({nearest['wind_gust_mph']} mph)")
        elif nearest.get("wind_speed_mph") is not None and nearest["wind_speed_mph"] > 15:
            conditions.append(f"moderate winds ({nearest['wind_speed_mph']} mph)")
        if nearest.get("erc") is not None and nearest["erc"] > 60:
            conditions.append(f"elevated ERC ({nearest['erc']})")
        if conditions:
            summary_text = (
                f"Risk is elevated near {nearest['station_name']} due to "
                f"{', '.join(conditions)}. "
                f"Monitor conditions closely."
            )
        else:
            summary_text = (
                f"Conditions near {nearest['station_name']} are within normal ranges. "
                f"RH {nearest.get('rh_pct', 'N/A')}%, "
                f"wind {nearest.get('wind_speed_mph', 'N/A')} mph."
            )

    return {
        "lat": lat,
        "lon": lon,
        "radius_miles": radius_miles,
        "raws_stations": stations,
        "cameras": [],   # placeholder for future camera integration
        "summary": summary_text if summary else "",
    }


# ── Agent: Customer Context ───────────────────────────────────────────────
@app.get("/api/agent/customer-context", tags=["Agent"])
def get_customer_context(
    customer_id: str = Query(..., description="Customer UUID"),
    db: Session = Depends(get_db), _: str = Depends(auth),
):
    """
    Return geographic and operational context for a customer.

    Resolution chain
    ----------------
    circuit_id  — customers.psps_event_id → psps_events.event_id
                  → psps_events.circuit_id
    lat / lon   — ST_Centroid of utility_circuits.geometry for that circuit
    wildfire_risk_band — normalised from customers.wildfire_risk
    hardening_status   — derived from has_transfer_meter +
                         has_permanent_battery + has_portable_battery:
                         COMPLETE / PARTIAL / NONE
    vegetation_work    — most recent row in vegetation_circuits whose
                         circuit_name matches; falls back to region match.
                         Uses last_trim_date as "completed" and
                         next_trim_due as "scheduled" entries.

    Response::

        {
          "lat": 37.123,
          "lon": -121.456,
          "circuit_id": "CIRCUIT_101",
          "wildfire_risk_band": "HIGH",
          "hardening_status": "PARTIAL",
          "vegetation_work": [
            {"type": "completed", "date": "2026-01-12", "distance_m": 200}
          ]
        }
    """
    # ── 1. Customer + linked circuit + geometry centroid ──────────────────
    row = db.execute(text("""
        SELECT
            c.id,
            c.region,
            c.hftd_tier          AS cust_hftd,
            c.wildfire_risk,
            c.has_transfer_meter,
            c.has_permanent_battery,
            c.has_portable_battery,
            c.psps_event_id,
            pe.circuit_id,
            ROUND(ST_Y(ST_Centroid(uc.geometry::geometry))::NUMERIC, 6) AS lat,
            ROUND(ST_X(ST_Centroid(uc.geometry::geometry))::NUMERIC, 6) AS lon
        FROM customers c
        LEFT JOIN psps_events pe
               ON pe.event_id = c.psps_event_id
              AND c.psps_event_id IS NOT NULL
              AND c.psps_event_id <> ''
        LEFT JOIN utility_circuits uc ON uc.circuit_id = pe.circuit_id
        WHERE c.id = :cid
    """), {"cid": customer_id}).fetchone()

    if not row:
        raise HTTPException(404, f"Customer '{customer_id}' not found")

    c = row._mapping

    # ── 2. Wildfire risk band ─────────────────────────────────────────────
    _BAND_MAP = {
        "low":      "LOW",
        "moderate": "MODERATE",
        "medium":   "MODERATE",
        "high":     "HIGH",
        "critical": "CRITICAL",
        "extreme":  "CRITICAL",
    }
    risk_band = _BAND_MAP.get((c["wildfire_risk"] or "low").lower(), "LOW")

    # ── 3. Hardening status ───────────────────────────────────────────────
    has_perm   = (c["has_permanent_battery"] or "None").strip() not in ("None", "", "No", "N/A")
    has_meter  = bool(c["has_transfer_meter"])
    has_port   = bool(c["has_portable_battery"])

    if has_perm and has_meter:
        hardening = "COMPLETE"
    elif has_perm or has_meter or has_port:
        hardening = "PARTIAL"
    else:
        hardening = "NONE"

    # ── 4. Vegetation work ────────────────────────────────────────────────
    # Try circuit-name match first; fall back to region.
    circuit_id = c["circuit_id"]
    region     = (c["region"] or "").strip()

    veg_rows = db.execute(text("""
        SELECT circuit_name, last_trim_date, next_trim_due,
               miles_conductor, hftd_tier, wildfire_risk
        FROM vegetation_circuits
        WHERE (:circuit_id IS NOT NULL AND circuit_name ILIKE '%' || :circuit_id || '%')
           OR (:region <> '' AND (
                 substation_zone ILIKE '%' || :region || '%'
              OR circuit_name    ILIKE '%' || :region || '%'
           ))
        ORDER BY last_trim_date DESC NULLS LAST
        LIMIT 3
    """), {"circuit_id": circuit_id, "region": region}).fetchall()

    vegetation_work = []
    for vr in veg_rows:
        vm = vr._mapping
        # Approximate distance: miles_conductor converted to metres (200 m minimum)
        dist_m = max(200, int((float(vm["miles_conductor"] or 0.125) * 1609.34)))
        if vm["last_trim_date"]:
            vegetation_work.append({
                "type":       "completed",
                "date":       str(vm["last_trim_date"]),
                "distance_m": dist_m,
            })
        if vm["next_trim_due"]:
            vegetation_work.append({
                "type":       "scheduled",
                "date":       str(vm["next_trim_due"]),
                "distance_m": dist_m,
            })

    return {
        "customer_id":       customer_id,
        "lat":               float(c["lat"]) if c["lat"] is not None else None,
        "lon":               float(c["lon"]) if c["lon"] is not None else None,
        "circuit_id":        circuit_id,
        "wildfire_risk_band": risk_band,
        "hardening_status":  hardening,
        "vegetation_work":   vegetation_work,
    }


# ── Agent: Program Eligibility ────────────────────────────────────────────
@app.get("/api/agent/program-eligibility", tags=["Agent"])
def get_program_eligibility(
    customer_id: str = Query(..., description="Customer UUID"),
    db: Session = Depends(get_db), _: str = Depends(auth),
):
    """
    Evaluate a customer's eligibility for utility assistance programs.

    Rules
    -----
    backup_power      — eligible if hftd_tier is Tier2 or Tier3, or
                        wildfire_risk is High / Critical / Extreme.
    medical_baseline  — reflects the customer's enrolled boolean; no
                        eligibility gate (self-attested at enrolment).
    generator_rebate  — eligible if in HFTD Tier 2/3 AND no permanent
                        battery already installed; or if wildfire_risk is
                        High/Critical AND customer has a documented outage
                        history; otherwise ineligible.

    Response::

        {
          "backup_power":      {"eligible": true,  "reason": "HFTD Tier 3"},
          "medical_baseline":  {"enrolled": false},
          "generator_rebate":  {"eligible": false, "reason": "Low outage frequency"}
        }
    """
    row = db.execute(text("""
        SELECT id, hftd_tier, wildfire_risk, medical_baseline,
               has_permanent_battery, has_transfer_meter,
               outage_history, arrears_status
        FROM customers
        WHERE id = :cid
    """), {"cid": customer_id}).fetchone()

    if not row:
        raise HTTPException(404, f"Customer '{customer_id}' not found")

    c = row._mapping
    tier        = (c["hftd_tier"] or "None").strip()
    risk        = (c["wildfire_risk"] or "Low").strip()
    perm_batt   = (c["has_permanent_battery"] or "None").strip()
    outage_hist = (c["outage_history"] or "").strip()

    _HFTD_HIGH = {"Tier2", "Tier3", "2", "3"}
    _RISK_HIGH  = {"High", "Critical", "Extreme"}

    # ── Backup Power ──────────────────────────────────────────────────────
    if tier in _HFTD_HIGH:
        bp_eligible = True
        bp_reason   = f"HFTD {tier}"
    elif risk in _RISK_HIGH:
        bp_eligible = True
        bp_reason   = f"{risk} wildfire risk"
    else:
        bp_eligible = False
        bp_reason   = "Not in HFTD Tier 2/3 and wildfire risk is not elevated"

    # ── Medical Baseline ──────────────────────────────────────────────────
    mb_enrolled = bool(c["medical_baseline"])

    # ── Generator Rebate ─────────────────────────────────────────────────
    already_equipped = perm_batt not in ("None", "", "No", "N/A")

    if already_equipped:
        gr_eligible = False
        gr_reason   = f"Permanent battery already installed ({perm_batt})"
    elif tier in _HFTD_HIGH:
        gr_eligible = True
        gr_reason   = f"HFTD {tier} — qualifies for backup generation rebate"
    elif risk in _RISK_HIGH and outage_hist:
        gr_eligible = True
        gr_reason   = f"{risk} wildfire risk with documented outage history"
    else:
        gr_eligible = False
        gr_reason   = "Low outage frequency" if not outage_hist else "Wildfire risk not elevated"

    return {
        "customer_id":     customer_id,
        "backup_power":    {"eligible": bp_eligible, "reason": bp_reason},
        "medical_baseline": {"enrolled": mb_enrolled},
        "generator_rebate": {"eligible": gr_eligible, "reason": gr_reason},
    }


@app.post("/models/train", tags=["Management"])
def train_models(req: TrainRequest, _: str = Depends(auth)):
    from models import train_psa_risk, train_ignition_spike
    results = {}
    if req.model in ("psa_risk", "both"):
        try: results["psa_risk"] = train_psa_risk.train()
        except Exception as e: results["psa_risk"] = {"status": "error", "error": str(e)}
    if req.model in ("ignition_spike", "both"):
        try: results["ignition_spike"] = train_ignition_spike.train(force_synthetic=req.synthetic)
        except Exception as e: results["ignition_spike"] = {"status": "error", "error": str(e)}
    return results


@app.post("/models/score", tags=["Management"])
def score_models(req: ScoreRequest, _: str = Depends(auth)):
    from models import train_psa_risk, train_ignition_spike
    d = req.prediction_date or date.today()
    results = {}
    if req.model in ("psa_risk", "both"):
        try: results["psa_risk"] = {"status": "ok", "stored": train_psa_risk.score_and_store(d)}
        except Exception as e: results["psa_risk"] = {"status": "error", "error": str(e)}
    if req.model in ("ignition_spike", "both"):
        try: results["ignition_spike"] = {"status": "ok", "stored": train_ignition_spike.score_and_store(d)}
        except Exception as e: results["ignition_spike"] = {"status": "error", "error": str(e)}
    return {"prediction_date": str(d), **results}


@app.get("/ingestion/status", tags=["Management"])
def ingestion_status(db: Session = Depends(get_db), _: str = Depends(auth)):
    rows = db.execute(text("""
        SELECT source, MAX(run_time) AS last_run, SUM(records_fetched) AS total_fetched,
               SUM(records_inserted) AS total_inserted,
               COUNT(*) FILTER (WHERE status = 'error') AS error_count
        FROM ingestion_log WHERE run_time >= NOW() - INTERVAL '24 hours'
        GROUP BY source ORDER BY source
    """)).fetchall()
    return {"scheduler_running": scheduler.running if scheduler else False,
            "sources": [dict(r._mapping) for r in rows]}


# ── PSPS Simulator ────────────────────────────────────────────────────────
@app.post("/api/psps/simulate", tags=["PSPS"])
def simulate_psps(req: SimulateRequest, db: Session = Depends(get_db), _: str = Depends(auth)):
    """
    Deterministic PSPS impact simulation for a set of circuits.

    Math (no ML inference, no external calls)
    -----------------------------------------
    customers_total    — SUM(utility_circuits.customer_count)
    critical           — SUM(utility_circuits.critical_customers)
    commercial         — ~15 % of non-critical customers (utility rule-of-thumb)
    residential        — remainder
    mw_lost            — customers_total × 4 kW average demand / 1 000
    restoration_hours  — average of (end_time − start_time) from historical
                         psps_events for these circuits; falls back to
                         horizon_hours × 0.35 (capped 4 – 72 h)
    hvra counts        — hospitals, water facilities in hvra_assets within
                         10 miles of any circuit geometry (ST_DWithin)

    Claude generates only the `summary` sentence and `assumptions` list.

    Response::

        {
          "scenario_id": "psps_00123",
          "summary": "Shutting off 2 circuits affects …",
          "customers_total": 3421,
          "customers_by_class": {"residential": 3200, "commercial": 210, "critical": 11},
          "mw_lost": 14.2,
          "estimated_restoration_hours": 8,
          "assumptions": ["Based on last 3 similar events.", …]
        }
    """
    if not req.circuit_ids:
        raise HTTPException(400, "circuit_ids must not be empty")

    circuit_ids = list(req.circuit_ids)

    # ── 1. Circuit metrics ────────────────────────────────────────────────
    circ_rows = db.execute(text("""
        SELECT circuit_id, circuit_name, customer_count,
               critical_customers, voltage_kv, length_miles,
               hftd_tier, county, psa_id, geometry
        FROM utility_circuits
        WHERE circuit_id = ANY(:ids)
    """), {"ids": circuit_ids}).fetchall()

    if not circ_rows:
        raise HTTPException(404, f"None of the circuit_ids found: {circuit_ids}")

    found_ids      = [r._mapping["circuit_id"] for r in circ_rows]
    missing_ids    = [c for c in circuit_ids if c not in found_ids]

    customers_total   = sum(int(r._mapping["customer_count"] or 0) for r in circ_rows)
    customers_critical = sum(int(r._mapping["critical_customers"] or 0) for r in circ_rows)
    customers_commercial = max(0, int((customers_total - customers_critical) * 0.15))
    customers_residential = max(0, customers_total - customers_critical - customers_commercial)
    mw_lost = round(customers_total * 0.004, 1)   # 4 kW avg demand per customer

    # ── 2. Historical restoration time ────────────────────────────────────
    hist_rows = db.execute(text("""
        SELECT AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) AS avg_hours,
               COUNT(*) AS event_count
        FROM psps_events
        WHERE circuit_id = ANY(:ids)
          AND end_time IS NOT NULL
          AND end_time > start_time
    """), {"ids": found_ids}).fetchone()

    hist = hist_rows._mapping if hist_rows else {}
    avg_hist_hours = hist.get("avg_hours")
    hist_event_count = int(hist.get("event_count") or 0)

    if avg_hist_hours and float(avg_hist_hours) > 0:
        est_restoration = max(4, min(72, round(float(avg_hist_hours))))
    else:
        est_restoration = max(4, min(72, round(req.horizon_hours * 0.35)))

    # ── 3. Nearby HVRA critical assets (within 10 miles of any circuit) ───
    hvra_rows = db.execute(text("""
        SELECT h.name, h.category, h.subcategory, h.population_served
        FROM hvra_assets h
        WHERE EXISTS (
            SELECT 1 FROM utility_circuits uc
            WHERE uc.circuit_id = ANY(:ids)
              AND uc.geometry IS NOT NULL
              AND ST_DWithin(
                  ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)::geography,
                  uc.geometry::geography,
                  16093.4    -- 10 miles in metres
              )
        )
        ORDER BY h.category, h.importance_weight DESC
    """), {"ids": found_ids}).fetchall()

    hvra_by_cat: dict = {}
    for h in hvra_rows:
        cat = h._mapping["category"]
        hvra_by_cat.setdefault(cat, []).append(dict(h._mapping))

    hospitals   = hvra_by_cat.get("Hospital", [])
    water_fac   = hvra_by_cat.get("Water", [])
    schools     = hvra_by_cat.get("School", [])

    # ── 4. Build deterministic context for Claude ─────────────────────────
    circuit_summary = [
        {"circuit_id": r._mapping["circuit_id"],
         "county": r._mapping["county"],
         "hftd_tier": r._mapping["hftd_tier"],
         "customer_count": r._mapping["customer_count"],
         "voltage_kv": float(r._mapping["voltage_kv"] or 0),
         "length_miles": float(r._mapping["length_miles"] or 0)}
        for r in circ_rows
    ]

    sim_facts = {
        "scenario_name":        req.scenario_name,
        "circuit_count":        len(found_ids),
        "horizon_hours":        req.horizon_hours,
        "customers_total":      customers_total,
        "customers_residential": customers_residential,
        "customers_commercial": customers_commercial,
        "customers_critical":   customers_critical,
        "mw_lost":              mw_lost,
        "est_restoration_h":    est_restoration,
        "hospitals_affected":   len(hospitals),
        "water_facilities":     len(water_fac),
        "schools_affected":     len(schools),
        "historical_events":    hist_event_count,
        "circuits":             circuit_summary,
    }

    # ── 5. Claude: summary + assumptions (optional, graceful fallback) ────
    summary_text = (
        f"De-energising {len(found_ids)} circuit(s) would affect "
        f"{customers_total:,} customers ({customers_critical} critical), "
        f"removing an estimated {mw_lost} MW. "
        f"Estimated restoration: {est_restoration} h."
    )
    assumptions = [
        f"Based on {hist_event_count} historical events for these circuits."
        if hist_event_count else "No prior event history; restoration estimate is modelled.",
        "No additional weather escalation beyond current forecast.",
        "Customer counts sourced from utility circuit registry; may not reflect real-time switching.",
    ]

    if settings.ANTHROPIC_API_KEY:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            prompt = (
                "You are a utility PSPS operations analyst. Given the simulation data below, "
                "produce two things:\n"
                "1. SUMMARY: one concise sentence (≤ 40 words) suitable for an ops dashboard, "
                "   mentioning circuits, customer count, critical facilities, and estimated restoration.\n"
                "2. ASSUMPTIONS: exactly 3 short bullet strings (no bullet characters) that a "
                "   planner would want to caveat this estimate with.\n\n"
                "Respond ONLY as valid JSON: "
                '{"summary": "...", "assumptions": ["...", "...", "..."]}\n\n'
                f"DATA:\n{json.dumps(sim_facts, default=str)}"
            )
            msg = client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=300,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()
            # strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            parsed = json.loads(raw)
            summary_text = parsed.get("summary", summary_text)
            assumptions  = parsed.get("assumptions", assumptions)
        except Exception as exc:
            logger.warning("PSPS simulate: Claude call failed (%s) — using fallback text", exc)

    # ── 6. Response ───────────────────────────────────────────────────────
    scenario_id = "psps_" + uuid.uuid4().hex[:5].upper()

    return {
        "scenario_id":    scenario_id,
        "scenario_name":  req.scenario_name,
        "circuits":       found_ids,
        "missing_circuits": missing_ids,
        "summary":        summary_text,
        "customers_total": customers_total,
        "customers_by_class": {
            "residential": customers_residential,
            "commercial":  customers_commercial,
            "critical":    customers_critical,
        },
        "hvra_affected": {
            "hospitals":         len(hospitals),
            "water_facilities":  len(water_fac),
            "schools":           len(schools),
        },
        "mw_lost":                    mw_lost,
        "estimated_restoration_hours": est_restoration,
        "historical_events_used":     hist_event_count,
        "assumptions":                assumptions,
    }


@app.post("/ingestion/trigger/{source}", tags=["Management"])
def trigger_ingestion(source: str, _: str = Depends(auth)):
    from ingestion import (fetch_psa_outlooks, fetch_active_incidents,
                           fetch_perimeters, fetch_raws_stations)
    dispatch = {
        "perimeters": fetch_perimeters.run,
        "incidents": fetch_active_incidents.run,
        "outlook_7day": lambda: fetch_psa_outlooks.run(which="7day"),
        "outlook_monthly": lambda: fetch_psa_outlooks.run(which="monthly"),
        "outlooks": fetch_psa_outlooks.run,
        "raws": fetch_raws_stations.run,
    }
    if source not in dispatch:
        raise HTTPException(400, f"Unknown source. Valid: {list(dispatch.keys())}")
    try:
        return {"source": source, "result": dispatch[source]()}
    except Exception as e:
        raise HTTPException(500, str(e))
