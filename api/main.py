"""
api/main.py — ExfSafeGrid Wildfire Ops & PSPS FastAPI Application v2
"""
import json
import logging
from contextlib import asynccontextmanager
from datetime import date
from typing import Optional
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
    model: str = "all"
    synthetic: bool = False


class ScoreRequest(BaseModel):
    prediction_date: Optional[date] = None
    model: str = "all"


class BriefingRequest(BaseModel):
    date: Optional[date] = None
    overwrite: bool = False


class WatchlistRequest(BaseModel):
    date: Optional[date] = None
    horizon: str = "24h"
    overwrite: bool = False


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
               mp.risk_bucket, mp.top_drivers AS drivers, mp.prediction_date,
               uc.hftd_tier, uc.customer_count, uc.county, uc.voltage_kv
        FROM model_predictions mp
        LEFT JOIN utility_circuits uc ON uc.circuit_id = mp.circuit_id
        WHERE mp.model_name = 'psa_risk'
          AND mp.prediction_date = (
              SELECT MAX(prediction_date) FROM model_predictions
              WHERE model_name = 'psa_risk' AND horizon_label = :horizon
                AND prediction_date <= :d
          )
          AND mp.horizon_label = :horizon
          AND mp.prob_score >= :min_prob {extra}
        ORDER BY mp.prob_score DESC LIMIT :limit
    """), params).fetchall()
    actual_date = rows[0]._mapping["prediction_date"] if rows else d
    return {"prediction_date": str(actual_date), "horizon": horizon, "model": "psa_risk",
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
               mp.risk_bucket AS risk_band, mp.top_drivers AS drivers, mp.prediction_date,
               uc.hftd_tier, uc.customer_count, uc.critical_customers, uc.county
        FROM model_predictions mp
        LEFT JOIN utility_circuits uc ON uc.circuit_id = mp.circuit_id
        WHERE mp.model_name = 'ignition_spike'
          AND mp.prediction_date = (
              SELECT MAX(prediction_date) FROM model_predictions
              WHERE model_name = 'ignition_spike' AND horizon_label = :horizon
                AND prediction_date <= :d
          )
          AND mp.horizon_label = :horizon
          AND mp.prob_score >= :min_prob {extra}
        ORDER BY mp.prob_score DESC LIMIT :limit
    """), params).fetchall()
    actual_date = rows[0]._mapping["prediction_date"] if rows else d
    return {"prediction_date": str(actual_date), "horizon_hours": horizon_hours, "model": "ignition_spike",
            "count": len(rows), "results": [dict(r._mapping) for r in rows]}


@app.get("/fire-spread-risk", tags=["Predictions"])
def get_fire_spread_risk(
    circuit_id: Optional[str] = Query(None),
    psa_id: Optional[str] = Query(None),
    min_spread: float = Query(0.0, ge=0),
    severity: Optional[str] = Query(None),
    prediction_date: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db), _: str = Depends(auth),
):
    """Model C: Fire spread & behavior risk. Returns spread_rate, flame_length, spotting_distance."""
    d = prediction_date or date.today()
    params = {"d": str(d), "min_spread": min_spread, "limit": limit}
    extra = ""
    if circuit_id:
        extra += " AND mp.circuit_id = :circuit_id"; params["circuit_id"] = circuit_id
    if psa_id:
        extra += " AND mp.psa_id = :psa_id"; params["psa_id"] = psa_id
    if severity:
        extra += " AND mp.risk_bucket = :severity"; params["severity"] = severity.upper()
    rows = db.execute(text(f"""
        SELECT mp.circuit_id, mp.psa_id, mp.prob_score AS spread_rate_ch_hr,
               mp.risk_bucket AS spread_severity, mp.top_drivers AS behavior_data,
               mp.prediction_date,
               uc.hftd_tier, uc.customer_count, uc.county
        FROM model_predictions mp
        LEFT JOIN utility_circuits uc ON uc.circuit_id = mp.circuit_id
        WHERE mp.model_name = 'fire_spread'
          AND mp.prediction_date = (
              SELECT MAX(prediction_date) FROM model_predictions
              WHERE model_name = 'fire_spread'
                AND prediction_date <= :d
          )
          AND mp.prob_score >= :min_spread {extra}
        ORDER BY mp.prob_score DESC LIMIT :limit
    """), params).fetchall()
    actual_date = rows[0]._mapping["prediction_date"] if rows else d
    return {"prediction_date": str(actual_date), "model": "fire_spread",
            "count": len(rows), "results": [dict(r._mapping) for r in rows]}


@app.get("/customer-density", tags=["Predictions"])
def get_customer_density(
    circuit_id: Optional[str] = Query(None),
    psa_id: Optional[str] = Query(None),
    risk_band: Optional[str] = Query(None),
    min_customers: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db), _: str = Depends(auth),
):
    """Customer density per circuit with latest risk overlay. Shows customer_count, critical_customers, medical_baseline impact."""
    params: dict = {"min_customers": min_customers, "limit": limit}
    extra = ""
    if circuit_id:
        extra += " AND uc.circuit_id = :circuit_id"; params["circuit_id"] = circuit_id
    if psa_id:
        extra += " AND uc.psa_id = :psa_id"; params["psa_id"] = psa_id
    if risk_band:
        extra += " AND latest.risk_bucket = :risk_band"; params["risk_band"] = risk_band.upper()
    rows = db.execute(text(f"""
        SELECT uc.circuit_id, uc.circuit_name, uc.psa_id, uc.county, uc.hftd_tier,
               uc.voltage_kv, COALESCE(uc.customer_count, 0) AS customer_count,
               COALESCE(uc.critical_customers, 0) AS critical_customers,
               latest.prob_score AS ignition_prob, latest.risk_bucket AS risk_band,
               latest.prediction_date
        FROM utility_circuits uc
        LEFT JOIN LATERAL (
            SELECT mp.prob_score, mp.risk_bucket, mp.prediction_date
            FROM model_predictions mp
            WHERE mp.circuit_id = uc.circuit_id AND mp.model_name = 'ignition_spike'
            ORDER BY mp.prediction_date DESC LIMIT 1
        ) latest ON TRUE
        WHERE COALESCE(uc.customer_count, 0) >= :min_customers {extra}
        ORDER BY COALESCE(uc.customer_count, 0) DESC LIMIT :limit
    """), params).fetchall()
    total_customers = sum(r._mapping.get("customer_count", 0) for r in rows)
    total_critical = sum(r._mapping.get("critical_customers", 0) for r in rows)
    return {
        "count": len(rows),
        "total_customers": total_customers,
        "total_critical_customers": total_critical,
        "results": [dict(r._mapping) for r in rows],
    }


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


@app.post("/models/train", tags=["Management"])
def train_models(req: TrainRequest, _: str = Depends(auth)):
    from models import train_psa_risk, train_ignition_spike, train_fire_spread
    results = {}
    if req.model in ("psa_risk", "both", "all"):
        try: results["psa_risk"] = train_psa_risk.train()
        except Exception as e: results["psa_risk"] = {"status": "error", "error": str(e)}
    if req.model in ("ignition_spike", "both", "all"):
        try: results["ignition_spike"] = train_ignition_spike.train(force_synthetic=req.synthetic)
        except Exception as e: results["ignition_spike"] = {"status": "error", "error": str(e)}
    if req.model in ("fire_spread", "all"):
        try: results["fire_spread"] = train_fire_spread.train(force_synthetic=req.synthetic)
        except Exception as e: results["fire_spread"] = {"status": "error", "error": str(e)}
    return results


@app.post("/models/score", tags=["Management"])
def score_models(req: ScoreRequest, _: str = Depends(auth)):
    from models import train_psa_risk, train_ignition_spike, train_fire_spread
    d = req.prediction_date or date.today()
    results = {}
    if req.model in ("psa_risk", "both", "all"):
        try: results["psa_risk"] = {"status": "ok", "stored": train_psa_risk.score_and_store(d)}
        except Exception as e: results["psa_risk"] = {"status": "error", "error": str(e)}
    if req.model in ("ignition_spike", "both", "all"):
        try: results["ignition_spike"] = {"status": "ok", "stored": train_ignition_spike.score_and_store(d)}
        except Exception as e: results["ignition_spike"] = {"status": "error", "error": str(e)}
    if req.model in ("fire_spread", "all"):
        try: results["fire_spread"] = {"status": "ok", "stored": train_fire_spread.score_and_store(d)}
        except Exception as e: results["fire_spread"] = {"status": "error", "error": str(e)}
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
