import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from config.settings import settings

logger = logging.getLogger(__name__)

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def log_ingestion(result: dict) -> None:
    """Write an ingestion run summary to ingestion_log. Never raises."""
    db = SessionLocal()
    try:
        db.execute(text("""
            INSERT INTO ingestion_log
                (source, records_fetched, records_inserted, records_updated,
                 status, error_msg, duration_sec)
            VALUES
                (:source, :records_fetched, :records_inserted, :records_updated,
                 :status, :error_msg, :duration_sec)
        """), {
            "source": result.get("source"),
            "records_fetched": result.get("records_fetched", 0),
            "records_inserted": result.get("records_inserted", 0),
            "records_updated": result.get("records_updated", 0),
            "status": result.get("status", "success"),
            "error_msg": result.get("error_msg"),
            "duration_sec": result.get("duration_sec"),
        })
        db.commit()
    except Exception as exc:
        logger.warning("Could not write ingestion_log: %s", exc)
    finally:
        db.close()
