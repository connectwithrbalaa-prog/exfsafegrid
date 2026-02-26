"""
agents/risk_sensor_agent.py
============================
Agent helpers for:
  • 12-hour hourly risk trend for a circuit  (GET /api/agent/risk-12h)
  • Nearby RAWS weather stations             (GET /api/agent/nearby-sensors)
  • Optional Claude one-sentence summary     (via generate_summary)

The hourly series is derived from the most recent ignition-spike model
predictions (24h horizon) stored in model_predictions.  Because the ML
model scores once per day the hourly points are linearly extrapolated from
the current probability using the trend direction computed from recent
prediction dates.
"""
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from config.settings import settings

logger = logging.getLogger(__name__)

# ── Trend thresholds ─────────────────────────────────────────────────────────

_TREND_THRESHOLD = 0.05       # minimum delta to call RISING or FALLING

# Hourly drift applied to the current prob when extrapolating forward
_HOURLY_DRIFT = {
    "RISING":  0.008,
    "FALLING": -0.006,
    "STABLE":  0.001,
}


# ── Risk 12-hour series ───────────────────────────────────────────────────────

def get_risk_12h(circuit_id: str, db: Session) -> dict:
    """
    Return a 12-point hourly risk series and trend label for a circuit.

    Queries the three most recent ignition-spike (24h) predictions and:
      • Computes RISING / FALLING / STABLE from the delta between the
        latest and second-latest prediction.
      • Extrapolates 12 hourly probability points forward from now.
    """
    rows = db.execute(text("""
        SELECT prediction_date, prob_score
        FROM model_predictions
        WHERE model_name = 'ignition_spike'
          AND horizon_label = '24h'
          AND circuit_id = :cid
        ORDER BY prediction_date DESC
        LIMIT 3
    """), {"cid": circuit_id}).fetchall()

    if not rows:
        return None          # caller will raise 404

    # oldest-first so index [-1] is the latest
    rows = list(reversed(rows))
    current_prob = float(rows[-1].prob_score)

    # Trend: compare latest to the previous prediction date
    if len(rows) >= 2:
        prev_prob = float(rows[-2].prob_score)
        delta = current_prob - prev_prob
        if delta > _TREND_THRESHOLD:
            trend_label = "RISING"
        elif delta < -_TREND_THRESHOLD:
            trend_label = "FALLING"
        else:
            trend_label = "STABLE"
    else:
        trend_label = "STABLE"

    # Build 12 hourly points starting from the top of the current hour
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    drift = _HOURLY_DRIFT[trend_label]

    hourly = []
    for i in range(12):
        t = now + timedelta(hours=i)
        prob = round(max(0.0, min(1.0, current_prob + drift * i)), 4)
        hourly.append({
            "time": t.strftime("%Y-%m-%dT%H:%MZ"),
            "prob": prob,
        })

    return {
        "circuit_id": circuit_id,
        "trend_label": trend_label,
        "hourly": hourly,
    }


# ── Nearby sensors ────────────────────────────────────────────────────────────

def get_nearby_sensors(
    lat: float,
    lon: float,
    db: Session,
    radius_miles: int = 25,
) -> dict:
    """
    Return RAWS weather stations within radius_miles of (lat, lon).

    Uses PostGIS ST_DWithin on the geometry column stored in
    raws_observations.  The most recent observation per station is
    returned, sorted by ascending distance.

    Cameras: no live camera feed is ingested at this time; the field is
    included in the response schema for forward-compatibility.
    """
    radius_m = radius_miles * 1609.34

    rows = db.execute(text("""
        SELECT DISTINCT ON (station_id)
            station_id,
            station_name,
            psa_id,
            obs_time,
            temp_f,
            rh_pct,
            wind_speed_mph,
            wind_gust_mph,
            wind_dir_deg,
            precip_in,
            erc,
            bi,
            ffwi,
            ROUND(
                (ST_Distance(
                    geometry::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) / 1609.34)::NUMERIC, 2
            ) AS distance_miles
        FROM raws_observations
        WHERE geometry IS NOT NULL
          AND ST_DWithin(
              geometry::geography,
              ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
              :radius_m
          )
        ORDER BY station_id, obs_time DESC
    """), {"lat": lat, "lon": lon, "radius_m": radius_m}).fetchall()

    stations = sorted(
        [dict(r._mapping) for r in rows],
        key=lambda x: x.get("distance_miles") or 9999,
    )

    # Serialise obs_time (datetime → ISO string) if needed
    for s in stations:
        if hasattr(s.get("obs_time"), "isoformat"):
            s["obs_time"] = s["obs_time"].isoformat()

    return {
        "lat": lat,
        "lon": lon,
        "radius_miles": radius_miles,
        "raws_stations": stations,
        "cameras": [],        # placeholder – no camera feed ingested yet
    }


# ── Claude one-sentence summary ───────────────────────────────────────────────

def generate_summary(risk_data: Optional[dict], sensor_data: dict) -> Optional[str]:
    """
    Call Claude to produce a single-sentence operational summary combining
    the risk series and nearest sensor conditions.

    Returns None if ANTHROPIC_API_KEY is not configured or on error.
    """
    if not settings.ANTHROPIC_API_KEY:
        logger.warning("generate_summary: ANTHROPIC_API_KEY not set, skipping")
        return None

    try:
        import anthropic

        risk_snippet = json.dumps(risk_data, default=str) if risk_data else "no risk data"
        sensor_snippet = json.dumps(
            {
                "raws_stations": sensor_data.get("raws_stations", [])[:3],
                "cameras": sensor_data.get("cameras", []),
            },
            default=str,
        )

        prompt = (
            "You are a wildfire operations analyst. "
            "Given the data below, write ONE concise sentence (≤ 30 words) summarising "
            "the current risk trend and sensor conditions for field operations. "
            "Output only the sentence — no quotes, no extra text.\n\n"
            f"RISK SERIES:\n{risk_snippet}\n\n"
            f"SENSOR DATA:\n{sensor_snippet}"
        )

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=80,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()

    except Exception as exc:
        logger.warning("generate_summary failed: %s", exc)
        return None
