import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ingestion import (
    fetch_active_incidents,
    fetch_perimeters,
    fetch_psa_outlooks,
    fetch_raws_stations,
)

logger = logging.getLogger(__name__)


def build_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")

    # Active incidents — every 30 minutes
    scheduler.add_job(
        fetch_active_incidents.run,
        IntervalTrigger(minutes=30),
        id="incidents",
        name="Fetch Active Incidents",
        misfire_grace_time=120,
    )

    # Fire perimeters — every hour
    scheduler.add_job(
        fetch_perimeters.run,
        IntervalTrigger(hours=1),
        id="perimeters",
        name="Fetch Fire Perimeters",
        misfire_grace_time=300,
    )

    # PSA outlooks (7-day and monthly) — every 6 hours
    scheduler.add_job(
        fetch_psa_outlooks.run,
        IntervalTrigger(hours=6),
        id="psa_outlooks",
        name="Fetch PSA Outlooks",
        misfire_grace_time=600,
    )

    # RAWS weather stations — every 3 hours
    scheduler.add_job(
        fetch_raws_stations.run,
        IntervalTrigger(hours=3),
        id="raws_stations",
        name="Fetch RAWS Stations",
        misfire_grace_time=300,
    )

    logger.info("Scheduler configured with %d jobs", len(scheduler.get_jobs()))
    return scheduler
