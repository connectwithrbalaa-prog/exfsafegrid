#!/usr/bin/env python3
"""
scripts/run_ingestion.py
=========================
Master ingestion orchestrator with configurable frequencies.

Usage:
  # Run all sources continuously (scheduled)
  python scripts/run_ingestion.py

  # Run a single source once and exit
  python scripts/run_ingestion.py --source perimeters --once

  # Run all sources once (bootstrap / CI)
  python scripts/run_ingestion.py --once

  # Override frequencies
  python scripts/run_ingestion.py --perimeter-interval 600 --outlook-interval 3600

Frequency defaults (seconds):
  Perimeters + Incidents : 900   (15 min)
  7-Day Outlooks         : 10800 (3 hours)
  Monthly Outlooks       : 86400 (daily)
  RAWS Stations          : 21600 (6 hours)

All upserts are idempotent — safe to run overlapping or restart.
"""
import argparse
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config.database import SessionLocal
from ingestion import (
    fetch_psa_outlooks,
    fetch_active_incidents,
    fetch_perimeters,
    fetch_raws_stations,
)

logger = logging.getLogger(__name__)

# ── Source registry ────────────────────────────────────────────────
SOURCES = {
    "perimeters": {
        "fn": fetch_perimeters.run,
        "default_interval": 900,
        "description": "Near-real-time wildfire perimeters (~5 min during events)",
        "priority": 1,
    },
    "incidents": {
        "fn": fetch_active_incidents.run,
        "default_interval": 900,
        "description": "Active NIFC IMSR wildfire incidents",
        "priority": 1,
    },
    "outlook_7day": {
        "fn": lambda db=None: fetch_psa_outlooks.run(db, which="7day"),
        "default_interval": 10800,
        "description": "NIFC 7-Day Significant Fire Potential Outlooks (Day 1–7)",
        "priority": 2,
    },
    "outlook_monthly": {
        "fn": lambda db=None: fetch_psa_outlooks.run(db, which="monthly"),
        "default_interval": 86400,
        "description": "NIFC Monthly/Extended Outlooks (Month 1–4)",
        "priority": 3,
    },
    "raws_stations": {
        "fn": fetch_raws_stations.run,
        "default_interval": 21600,
        "description": "Key PSA/GACC RAWS weather & fuels observations",
        "priority": 2,
    },
}


# ── Single-run function ────────────────────────────────────────────
def run_source(name: str) -> dict:
    """Run a single ingestion source and return result dict.
    ingestion_log is written automatically inside each run() function
    via config.database.log_ingestion — no duplicate write needed here.
    """
    source = SOURCES[name]
    logger.info("▶ Starting: %s", name)
    db = SessionLocal()
    try:
        result = source["fn"](db)
        results = result if isinstance(result, list) else [result]
        for r in results:
            icon = "✓" if r.get("status") == "success" else "✗"
            logger.info(
                "%s %s: fetched=%s ins=%s upd=%s (%.1fs)",
                icon, r.get("source", name),
                r.get("records_fetched", "?"),
                r.get("records_inserted", "?"),
                r.get("records_updated", "?"),
                r.get("duration_sec", 0),
            )
            if r.get("error_msg"):
                logger.error("  Error: %s", r["error_msg"])
        return result
    except Exception as exc:
        logger.exception("Source %s raised exception: %s", name, exc)
        return {"source": name, "status": "error", "error_msg": str(exc)}
    finally:
        db.close()


# ── Scheduled loop ─────────────────────────────────────────────────
def run_scheduled(intervals: dict, sources_filter: Optional[list] = None) -> None:
    """
    Run ingestion sources on configurable intervals forever.
    intervals: {source_name: interval_seconds}
    """
    # Track last run time per source
    last_run = {}
    active_sources = [s for s in SOURCES if not sources_filter or s in sources_filter]

    # Sort by priority so perimeters/incidents go first
    active_sources.sort(key=lambda s: SOURCES[s]["priority"])

    logger.info("=" * 60)
    logger.info("ExfSafeGrid Ingestion Scheduler Started")
    logger.info("Active sources:")
    for s in active_sources:
        interval = intervals.get(s, SOURCES[s]["default_interval"])
        logger.info("  %-20s every %ds (%s)", s, interval, _format_interval(interval))
    logger.info("=" * 60)

    while True:
        now = time.time()
        for name in active_sources:
            interval = intervals.get(name, SOURCES[name]["default_interval"])
            last = last_run.get(name, 0)
            if now - last >= interval:
                run_source(name)
                last_run[name] = time.time()
        # Sleep 30 seconds between checks
        time.sleep(30)


def _format_interval(seconds: int) -> str:
    if seconds < 3600:
        return f"{seconds // 60}min"
    if seconds < 86400:
        return f"{seconds // 3600}h"
    return f"{seconds // 86400}d"


# ── CLI ────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="ExfSafeGrid NIFC ingestion master script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Sources: perimeters, incidents, outlook_7day, outlook_monthly, raws_stations

Examples:
  python scripts/run_ingestion.py                          # run all continuously
  python scripts/run_ingestion.py --once                   # bootstrap run
  python scripts/run_ingestion.py --source perimeters      # single source loop
  python scripts/run_ingestion.py --source perimeters --once
        """,
    )
    parser.add_argument(
        "--source",
        choices=list(SOURCES.keys()),
        default=None,
        help="Run only this source (default: all)",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run each source once then exit (no scheduling loop)",
    )
    parser.add_argument(
        "--perimeter-interval", type=int, default=900,
        help="Perimeter + incident fetch interval in seconds (default: 900)",
    )
    parser.add_argument(
        "--outlook-interval", type=int, default=10800,
        help="7-Day outlook fetch interval in seconds (default: 10800)",
    )
    parser.add_argument(
        "--monthly-interval", type=int, default=86400,
        help="Monthly outlook interval in seconds (default: 86400)",
    )
    parser.add_argument(
        "--raws-interval", type=int, default=21600,
        help="RAWS fetch interval in seconds (default: 21600)",
    )
    parser.add_argument(
        "--log-level", default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    intervals = {
        "perimeters": args.perimeter_interval,
        "incidents": args.perimeter_interval,
        "outlook_7day": args.outlook_interval,
        "outlook_monthly": args.monthly_interval,
        "raws_stations": args.raws_interval,
    }

    sources_filter = [args.source] if args.source else None

    if args.once:
        active = sources_filter or list(SOURCES.keys())
        active.sort(key=lambda s: SOURCES[s]["priority"])
        logger.info("Running %d sources once...", len(active))
        for name in active:
            run_source(name)
        logger.info("Bootstrap ingestion complete.")
    else:
        try:
            run_scheduled(intervals, sources_filter)
        except KeyboardInterrupt:
            logger.info("Ingestion scheduler stopped.")


if __name__ == "__main__":
    main()
