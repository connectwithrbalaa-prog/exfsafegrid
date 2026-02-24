"""
agents/psps_planning_agent.py
================================
PSPS Planning Agent v0 — Calls /circuit-ignition-risk for each circuit,
then ranks by risk × criticality and produces a Markdown + JSON watchlist.
Stores output in: psps_watchlists table
Run standalone:
  python agents/psps_planning_agent.py
  python agents/psps_planning_agent.py --horizon 48h --date 2025-07-15
"""
import argparse
import json
import logging
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

import anthropic
from sqlalchemy import text
from sqlalchemy.orm import Session

from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a PSPS (Public Safety Power Shutoff) Planning Specialist.
Your role is to produce a prioritized watchlist of circuits that may require de-energization.

Evaluate each circuit on:
- Ignition spike probability (Model B)
- HFTD tier (3 = highest wildfire risk zone)
- Customer impact (count + critical facilities)
- Active fires and acres burning in proximity
- 7-Day fire potential outlook for their PSA
- Recent PSPS history on this circuit

Produce output in TWO parts:

PART 1 — JSON only (no prose, valid JSON):
{
  "watchlist_date": "YYYY-MM-DD",
  "horizon": "24h|48h|72h",
  "watchlist": [
    {
      "rank": 1,
      "circuit_id": "...",
      "risk_bucket": "CRITICAL|HIGH|MODERATE",
      "prob_spike": 0.00,
      "recommended_action": "MONITOR|ALERT|STAGE|DE-ENERGIZE",
      "trigger_rationale": "primary reason in one sentence",
      "customer_count": 0,
      "critical_customers": 0,
      "hftd_tier": 2,
      "psa_id": "...",
      "top_driver": "..."
    }
  ],
  "immediate_actions": ["action 1", "action 2"],
  "summary": "one paragraph executive summary"
}

PART 2 — Markdown watchlist (for display in ExfSafeGrid):
## PSPS Watchlist — {date} ({horizon} horizon)
[Formatted table or bullet list of watchlist circuits]

### Immediate Actions
[numbered list]
"""


def _get_circuits_for_assessment(db: Session, assessment_date: date, horizon: str) -> list:
    """Pull circuits with HIGH/CRITICAL ignition risk from model_predictions."""
    rows = db.execute(text("""
        SELECT
            mp.circuit_id,
            mp.risk_bucket,
            ROUND(mp.prob_score::NUMERIC, 4)  AS prob_spike,
            mp.top_drivers,
            uc.psa_id,
            uc.hftd_tier,
            uc.customer_count,
            uc.critical_customers,
            uc.length_miles,
            uc.voltage_kv,
            uc.county,
            -- PSA outlook Day1
            o.fire_potential_label               AS outlook_d1,
            o.fire_potential                     AS outlook_d1_val,
            -- Model A seasonal risk
            ma.prob_score                        AS psa_seasonal_risk,
            -- Active incidents near this circuit's PSA
            COALESCE(inc.active_count, 0)        AS active_fires_nearby,
            COALESCE(inc.total_acres, 0)         AS acres_nearby,
            -- Recent PSPS on this circuit
            COALESCE(ph.recent_events, 0)        AS recent_psps_events
        FROM model_predictions mp
        JOIN utility_circuits uc ON uc.circuit_id = mp.circuit_id
        LEFT JOIN LATERAL (
            SELECT fire_potential_label, fire_potential
            FROM psa_outlook
            WHERE psa_id = uc.psa_id
              AND outlook_type = '7day'
              AND period_label = 'Day1'
              AND forecast_date = :today
            LIMIT 1
        ) o ON TRUE
        LEFT JOIN LATERAL (
            SELECT prob_score FROM model_predictions
            WHERE circuit_id = mp.circuit_id
              AND model_name = 'psa_risk'
              AND prediction_date = :today
            LIMIT 1
        ) ma ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS active_count, SUM(acres_burned) AS total_acres
            FROM incidents
            WHERE psa_id = uc.psa_id AND is_active = TRUE
        ) inc ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS recent_events
            FROM psps_events
            WHERE circuit_id = uc.circuit_id
              AND start_time >= :since
        ) ph ON TRUE
        WHERE mp.model_name = 'ignition_spike'
          AND mp.horizon_label = :horizon
          AND mp.prediction_date = :today
          AND (mp.risk_bucket IN ('HIGH', 'CRITICAL') OR uc.hftd_tier = 3)
        ORDER BY mp.prob_score DESC
        LIMIT 30
    """), {
        "today": str(assessment_date),
        "horizon": horizon,
        "since": str(assessment_date - timedelta(days=30)),
    }).fetchall()
    return [dict(r._mapping) for r in rows]


def run(
    db: Optional[Session] = None,
    watchlist_date: Optional[date] = None,
    horizon: str = "24h",
    overwrite: bool = False,
) -> dict:
    """
    Run PSPS planning assessment and store watchlist.
    Returns dict with status, markdown_text, structured_data.
    """
    if watchlist_date is None:
        watchlist_date = date.today()
    if horizon not in ("24h", "48h", "72h"):
        return {"status": "error", "error": f"Invalid horizon: {horizon}"}
    if not settings.ANTHROPIC_API_KEY:
        return {"status": "error", "error": "ANTHROPIC_API_KEY not configured"}

    own_db = db is None
    if own_db:
        db = SessionLocal()

    try:
        if not overwrite:
            existing = db.execute(
                text("SELECT markdown_text FROM psps_watchlists WHERE watchlist_date = :d AND horizon = :h"),
                {"d": str(watchlist_date), "h": horizon},
            ).fetchone()
            if existing:
                return {"status": "cached", "watchlist_date": str(watchlist_date), "horizon": horizon,
                        "markdown_text": existing[0]}

        circuits = _get_circuits_for_assessment(db, watchlist_date, horizon)

        if not circuits:
            no_risk_msg = (
                f"## PSPS Watchlist — {watchlist_date} ({horizon})\n\n"
                "✅ No circuits at elevated PSPS risk. Continue monitoring."
            )
            db.execute(text("""
                INSERT INTO psps_watchlists (watchlist_date, horizon, markdown_text, structured_data, model_used, tokens_used)
                VALUES (:d, :h, :md, '{"watchlist":[]}'::JSONB, :model, 0)
                ON CONFLICT (watchlist_date, horizon) DO UPDATE SET markdown_text = EXCLUDED.markdown_text
            """), {"d": str(watchlist_date), "h": horizon, "md": no_risk_msg, "model": settings.CLAUDE_MODEL})
            db.commit()
            return {"status": "success", "watchlist_date": str(watchlist_date), "horizon": horizon,
                    "markdown_text": no_risk_msg, "watchlist": []}

        user_msg = (
            f"Assess the following {len(circuits)} circuits for PSPS watchlist on {watchlist_date} "
            f"({horizon} horizon).\n\n"
            f"Circuit Risk Data:\n{json.dumps(circuits, indent=2, default=str)}"
        )

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=2500,
            system=SYSTEM_PROMPT.replace("{date}", str(watchlist_date)).replace("{horizon}", horizon),
            messages=[{"role": "user", "content": user_msg}],
        )

        raw = msg.content[0].text
        tokens = msg.usage.input_tokens + msg.usage.output_tokens

        # Parse JSON block from PART 1
        import re
        structured = {}
        json_match = re.search(r'\{[^{}]*"watchlist"[^{}]*\[.*?\][^{}]*\}', raw, re.DOTALL)
        if json_match:
            try:
                structured = json.loads(json_match.group())
            except Exception:
                structured = {"raw_response": raw[:500]}

        # Markdown is everything after the JSON block
        parts = raw.split("## PSPS Watchlist", 1)
        markdown_text = "## PSPS Watchlist" + parts[1] if len(parts) > 1 else raw

        db.execute(text("""
            INSERT INTO psps_watchlists
                (watchlist_date, horizon, markdown_text, structured_data, model_used, tokens_used)
            VALUES (:d, :h, :md, :struct::JSONB, :model, :tok)
            ON CONFLICT (watchlist_date, horizon) DO UPDATE SET
                markdown_text = EXCLUDED.markdown_text,
                structured_data = EXCLUDED.structured_data,
                tokens_used = EXCLUDED.tokens_used,
                created_at = NOW()
        """), {
            "d": str(watchlist_date), "h": horizon,
            "md": markdown_text,
            "struct": json.dumps(structured, default=str),
            "model": settings.CLAUDE_MODEL, "tok": tokens,
        })
        db.commit()

        watchlist = structured.get("watchlist", [])
        logger.info("✓ PSPS watchlist %s %s: %d circuits, %d tokens",
                    watchlist_date, horizon, len(watchlist), tokens)
        return {
            "status": "success",
            "watchlist_date": str(watchlist_date),
            "horizon": horizon,
            "markdown_text": markdown_text,
            "watchlist": watchlist,
            "immediate_actions": structured.get("immediate_actions", []),
            "summary": structured.get("summary", ""),
            "tokens_used": tokens,
        }
    except Exception as exc:
        logger.exception("PSPS planning failed: %s", exc)
        return {"status": "error", "error": str(exc)}
    finally:
        if own_db:
            db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=None)
    parser.add_argument("--horizon", default="24h", choices=["24h", "48h", "72h"])
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level), format="%(asctime)s %(levelname)s %(message)s")
    d = date.fromisoformat(args.date) if args.date else None
    r = run(watchlist_date=d, horizon=args.horizon, overwrite=args.overwrite)
    print(r.get("markdown_text") or json.dumps(r, indent=2, default=str))
